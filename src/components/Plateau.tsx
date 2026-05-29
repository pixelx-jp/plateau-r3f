import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { ColorPlan, HazardLayerState, PlateauProps } from '../types/public';
import { createPlateauRuntime, type PlateauRuntime } from '../core/PlateauRuntime';
import { createPlateauStore } from '../store/createPlateauStore';
import { PlateauContext, type PlateauContextValue } from '../hooks/usePlateauContext';
import { FallbackExtrusionLayer } from '../fallback/FallbackExtrusionLayer';

let planVersionCounter = 1;

export function Plateau(props: PlateauProps): JSX.Element {
  const {
    city,
    baseUrl,
    colorBy,
    opacity = 1,
    missingColor = '#bbbbbb',
    fallback = 'auto',
    resolver,
    shaderExtensions,
    styleDecoder,
    onReady,
    onError,
    children,
  } = props;

  const { gl, camera } = useThree();
  const groupRef = useRef<THREE.Group | null>(null);

  const [runtime, setRuntime] = useState<PlateauRuntime | null>(null);
  const storeRef = useRef(createPlateauStore());
  const layersRef = useRef<Map<string, HazardLayerState>>(new Map());

  // boot
  useEffect(() => {
    let cancelled = false;
    storeRef.current.setStatus('loading');
    const plan: ColorPlan = {
      colorBy,
      opacity,
      missingColor,
      version: planVersionCounter++,
    };
    const store = storeRef.current;
    createPlateauRuntime({
      city,
      baseUrl,
      resolver,
      shaderExtensions,
      styleDecoder,
      initialColorPlan: plan,
      initialHazardLayers: Array.from(layersRef.current.values()),
      fallbackPolicy: fallback,
      onError,
      onVisibleTilesChange: (uris) => store.setVisibleTileUris(uris),
      onColorPlanChange: () => store.bumpColorPlanVersion(),
    })
      .then((rt) => {
        if (cancelled) {
          rt.dispose();
          return;
        }
        setRuntime(rt);
        storeRef.current.setStatus('ready');
        onReady?.(rt);
      })
      .catch(() => {
        if (!cancelled) storeRef.current.setStatus('error');
      });
    return () => {
      cancelled = true;
    };
    // Resolver / decoder / extensions are typically stable references; if the
    // user changes them, expect a full runtime rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, baseUrl, resolver, styleDecoder, shaderExtensions]);

  useEffect(() => {
    return () => {
      runtime?.dispose();
    };
  }, [runtime]);

  // attach to group
  useEffect(() => {
    if (!runtime || !groupRef.current) return;
    groupRef.current.add(runtime.group);
    return () => {
      groupRef.current?.remove(runtime.group);
    };
  }, [runtime]);

  // camera + renderer
  useEffect(() => {
    if (!runtime) return;
    runtime.setCamera(camera);
    runtime.setResolutionFromRenderer(camera, gl);
  }, [runtime, camera, gl]);

  // update plan when colorBy/opacity change
  useEffect(() => {
    if (!runtime) return;
    runtime.setColorPlan({
      colorBy,
      opacity,
      missingColor,
      version: planVersionCounter++,
    });
    storeRef.current.bumpColorPlanVersion();
  }, [runtime, colorBy, opacity, missingColor]);

  useEffect(() => {
    if (!runtime) return;
    runtime.setFallbackPolicy(fallback);
  }, [runtime, fallback]);

  useFrame(() => {
    if (!runtime) return;
    runtime.update();
  });

  const ctx: PlateauContextValue | null = useMemo(() => {
    if (!runtime) return null;
    return {
      runtime,
      artifacts: runtime.artifacts,
      store: storeRef.current,
      registerHazardLayer(layer) {
        // Only insert if new — Map preserves insertion order, and updating in
        // place via .set() with an existing key keeps that order. Use
        // updateHazardLayer() for subsequent prop changes.
        layersRef.current.set(layer.id, layer);
        runtime.setHazardLayers(Array.from(layersRef.current.values()));
        storeRef.current.setEnabledLayerIds(
          Array.from(layersRef.current.values())
            .filter((l) => l.visible)
            .map((l) => l.id),
        );
        return () => {
          layersRef.current.delete(layer.id);
          runtime.setHazardLayers(Array.from(layersRef.current.values()));
          storeRef.current.setEnabledLayerIds(
            Array.from(layersRef.current.values())
              .filter((l) => l.visible)
              .map((l) => l.id),
          );
        };
      },
      updateHazardLayer(layer) {
        if (!layersRef.current.has(layer.id)) return;
        // Map.set keeps insertion order when the key already exists.
        layersRef.current.set(layer.id, layer);
        runtime.setHazardLayers(Array.from(layersRef.current.values()));
      },
    };
  }, [runtime]);

  return (
    <group ref={groupRef}>
      {ctx ? (
        <PlateauContext.Provider value={ctx}>
          {/*
            Always mount the fallback layer; it renders only when the runtime
            decides PMTiles fallback is active. Users can still mount their
            own `<FallbackExtrusionLayer>` for custom styling — duplicate
            mounts are harmless.
          */}
          <FallbackExtrusionLayer />
          {children}
        </PlateauContext.Provider>
      ) : null}
    </group>
  );
}
