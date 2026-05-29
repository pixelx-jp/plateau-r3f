import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { FootprintLayerProps } from '../types/public';
import { usePlateauContextOptional } from '../hooks/usePlateauContext';
import { createPmtilesClient } from '../footprint/PmtilesClient';
import { decodePolygonFeatures, type FootprintTileFeature } from '../footprint/mvtDecode';
import { lngLatToTileXY, lngLatToMercatorMeters } from '../footprint/lngLatToMercator';
import earcut from 'earcut';
import { parseColor } from '../style/ColorRamp';
import { compileColorBy } from '../style/colorBy';
import { compileHazardLayer } from '../hazards/hazardColor';
import { createSyntheticStyleTable } from '../footprint/syntheticStyleTable';
import type { BuildingAttributes, ColorBy } from '../types/public';

const DEFAULT_ZOOM = 15;
const MVT_LAYER_NAME = 'buildings';

// pmtilesUrl, zoom, flat are now on FootprintLayerProps directly.

async function gunzipIfNeeded(data: ArrayBuffer): Promise<ArrayBuffer> {
  const u8 = new Uint8Array(data);
  if (u8.length < 2 || u8[0] !== 0x1f || u8[1] !== 0x8b) return data;
  const ds = new DecompressionStream('gzip');
  const decompressed = await new Response(
    new Response(data).body!.pipeThrough(ds),
  ).arrayBuffer();
  return decompressed;
}

function buildAttrsFromProps(
  props: Record<string, number | string | boolean>,
): BuildingAttributes {
  return {
    tile_content_uri: 'pmtiles://',
    feature_id: -1,
    source: 'pmtiles-fallback',
    height: typeof props.height === 'number' ? props.height : null,
    floors: typeof props.floors_above === 'number' ? props.floors_above : null,
    structure: typeof props.structure === 'string' ? props.structure : null,
    river_flood_covered: typeof props.river_flood_covered === 'boolean' ? props.river_flood_covered : null,
    river_flood_depth_max: typeof props.river_flood_depth_max === 'number' ? props.river_flood_depth_max : null,
    inland_flood_covered: typeof props.inland_flood_covered === 'boolean' ? props.inland_flood_covered : null,
    tsunami_covered: typeof props.tsunami_covered === 'boolean' ? props.tsunami_covered : null,
    storm_surge_covered: typeof props.storm_surge_covered === 'boolean' ? props.storm_surge_covered : null,
    landslide_covered: typeof props.landslide_covered === 'boolean' ? props.landslide_covered : null,
    landslide_in_zone: typeof props.landslide_in_zone === 'boolean' ? props.landslide_in_zone : null,
    _attribution: [],
    ...props,
  } as BuildingAttributes;
}

interface BuiltMesh {
  positions: Float32Array;
  colors: Uint8Array;
  indices: Uint32Array;
}

function triangulatePolygon(
  rings: Array<Array<[number, number]>>,
): { indices: number[]; vertexCount: number } {
  const flat: number[] = [];
  const holes: number[] = [];
  let vertexCount = 0;
  for (let r = 0; r < rings.length; r++) {
    if (r > 0) holes.push(vertexCount);
    const ring = rings[r];
    for (const [x, y] of ring) {
      flat.push(x, y);
      vertexCount++;
    }
  }
  const indices = earcut(flat, holes.length ? holes : undefined, 2);
  return { indices, vertexCount };
}

function computeTileBbox(
  tileFeatures: FootprintTileFeature[],
  refX: number,
  refY: number,
): THREE.Box3 {
  const box = new THREE.Box3();
  for (const f of tileFeatures) {
    const ring = f.rings[0];
    if (!ring) continue;
    for (const [x, y] of ring) {
      const wx = x - refX;
      const wy = 0;
      const wz = -(y - refY);
      box.expandByPoint(new THREE.Vector3(wx, wy, wz));
      box.expandByPoint(new THREE.Vector3(wx, f.height, wz));
    }
  }
  return box;
}

function buildMesh(
  features: Array<{ feature: FootprintTileFeature; color: [number, number, number] }>,
  originX: number,
  originY: number,
): BuiltMesh {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let baseVertex = 0;

  for (const { feature, color } of features) {
    const outer = feature.rings[0];
    if (!outer || outer.length < 3) continue;
    const h = feature.height;
    const tri = triangulatePolygon(feature.rings);
    if (tri.indices.length === 0) continue;
    const topStart = baseVertex;
    const botStart = baseVertex + tri.vertexCount;

    // Emit top ring(s)
    for (const ring of feature.rings) {
      for (const [x, y] of ring) {
        positions.push(x - originX, h, -(y - originY));
        colors.push(color[0], color[1], color[2]);
      }
    }
    // Emit bottom ring(s) (darker)
    for (const ring of feature.rings) {
      for (const [x, y] of ring) {
        positions.push(x - originX, 0, -(y - originY));
        colors.push(
          Math.round(color[0] * 0.7),
          Math.round(color[1] * 0.7),
          Math.round(color[2] * 0.7),
        );
      }
    }

    // Top cap (triangulated)
    for (const idx of tri.indices) indices.push(topStart + idx);
    // Bottom cap (flip winding)
    for (let i = 0; i < tri.indices.length; i += 3) {
      indices.push(
        botStart + tri.indices[i],
        botStart + tri.indices[i + 2],
        botStart + tri.indices[i + 1],
      );
    }
    // Side walls — iterate each ring independently
    let ringOffset = 0;
    for (const ring of feature.rings) {
      const ringLen = ring.length;
      for (let i = 0; i < ringLen; i++) {
        const a = topStart + ringOffset + i;
        const b = topStart + ringOffset + ((i + 1) % ringLen);
        const c = botStart + ringOffset + ((i + 1) % ringLen);
        const d = botStart + ringOffset + i;
        indices.push(a, c, b, a, d, c);
      }
      ringOffset += ringLen;
    }

    baseVertex += tri.vertexCount * 2;
  }

  return {
    positions: new Float32Array(positions),
    colors: new Uint8Array(colors),
    indices: new Uint32Array(indices),
  };
}

export function FootprintLayer(props: FootprintLayerProps): JSX.Element {
  const ctx = usePlateauContextOptional();
  const opacity = props.opacity ?? 1;
  const visible = props.visible ?? true;
  const zoom = props.zoom ?? DEFAULT_ZOOM;
  const registeredRef = useRef<string[]>([]);

  const pmtilesUrl = props.pmtilesUrl ?? ctx?.artifacts.pmtilesUrl;

  const [geom, setGeom] = useState<{
    positions: Float32Array;
    colors: Uint8Array;
    indices: Uint32Array;
    center: THREE.Vector3;
  } | null>(null);

  // Subscribe to the runtime's color plan version so we recolor when the
  // user toggles colorBy or adds/removes a <HazardLayer>.
  const [planSignal, setPlanSignal] = useState(0);
  useEffect(() => {
    if (!ctx) return;
    const unsub = ctx.store.subscribe((s, prev) => {
      if (s.colorPlanVersion !== prev.colorPlanVersion) setPlanSignal((n) => n + 1);
    });
    return unsub;
  }, [ctx]);

  // Use the parent runtime's colorBy + hazard plan when one isn't passed
  // explicitly on the FootprintLayer. This keeps fallback visually consistent.
  const effectiveColorBy: ColorBy | undefined =
    props.colorBy ?? ctx?.runtime.getColorPlan().colorBy;
  const effectiveHazards = ctx?.runtime.getHazardLayers() ?? [];

  const compiledColor = useMemo(
    () => compileColorBy(effectiveColorBy, '#cccccc'),
    // planSignal forces recompile when runtime plan changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveColorBy, planSignal],
  );
  const compiledHazards = useMemo(
    () => effectiveHazards.filter((l) => l.visible).map(compileHazardLayer),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(effectiveHazards), planSignal],
  );

  useEffect(() => {
    if (!visible || !pmtilesUrl) return;
    let cancelled = false;
    (async () => {
      const client = createPmtilesClient(pmtilesUrl);
      const header = await client.source.getHeader();
      const z = Math.max(header.minZoom, Math.min(header.maxZoom, zoom));
      // Handle antimeridian crossing: PLATEAU coverage is Japan-only so we
      // never expect it in practice, but if the dataset crosses ±180° we
      // split into two ranges. Polar regions (lat > ~85.05°) are clamped by
      // the Mercator projection automatically.
      const crossesAntimeridian = header.minLon > header.maxLon;
      const ranges: Array<{ minLon: number; maxLon: number }> = crossesAntimeridian
        ? [
            { minLon: header.minLon, maxLon: 180 - 1e-9 },
            { minLon: -180, maxLon: header.maxLon },
          ]
        : [{ minLon: header.minLon, maxLon: header.maxLon }];
      const tileRanges = ranges.map((r) => {
        const [x0, y0] = lngLatToTileXY(r.minLon, header.maxLat, z);
        const [x1, y1] = lngLatToTileXY(r.maxLon, header.minLat, z);
        return {
          minX: Math.floor(x0),
          maxX: Math.ceil(x1) - 1,
          minY: Math.floor(y0),
          maxY: Math.ceil(y1) - 1,
        };
      });

      const features: Array<{ feature: FootprintTileFeature; color: [number, number, number] }> = [];
      // Clear any prior registrations for a fresh load.
      if (ctx?.runtime) {
        for (const uri of registeredRef.current) ctx.runtime.unregisterFootprintTile(uri);
      }
      registeredRef.current = [];
      for (const tr of tileRanges) {
       for (let tx = tr.minX; tx <= tr.maxX; tx++) {
        for (let ty = tr.minY; ty <= tr.maxY; ty++) {
          if (cancelled) return;
          let data: ArrayBuffer | undefined;
          try {
            data = await client.getTile(z, tx, ty);
          } catch {
            continue;
          }
          if (!data) continue;
          const decompressed = await gunzipIfNeeded(data);
          const tileFeatures = decodePolygonFeatures(decompressed, z, tx, ty, MVT_LAYER_NAME);
          if (tileFeatures.length === 0) continue;
          const tileUri = `pmtiles://${z}/${tx}/${ty}`;
          const rows = tileFeatures.map((tf) => tf.properties);
          const synthTable = createSyntheticStyleTable(tileUri, rows);

          // Register full BuildingAttributes for queryVisibleBuildings lookups.
          if (ctx?.runtime) {
            const entries: BuildingAttributes[] = tileFeatures.map((tf, ordinal) => ({
              ...buildAttrsFromProps(tf.properties),
              tile_content_uri: tileUri,
              feature_id: ordinal,
              source: 'pmtiles-fallback',
            }));
            // Compute a world-space bbox for frustum culling later. The mesh
            // builder subtracts `refX/refY` and flips Z, so we approximate
            // using each tile's mercator corners.
            const refLng = (header.minLon + header.maxLon) / 2;
            const refLat = (header.minLat + header.maxLat) / 2;
            const [refX, refY] = lngLatToMercatorMeters(refLng, refLat);
            const bbox = computeTileBbox(tileFeatures, refX, refY);
            ctx.runtime.registerFootprintTile(tileUri, entries, bbox);
            registeredRef.current.push(tileUri);
          }

          for (let i = 0; i < tileFeatures.length; i++) {
            const f = tileFeatures[i];
            // Run the same colorBy + hazard pipeline used for 3D Tiles.
            let rgba = compiledColor.evaluate(i, synthTable);
            for (const hazard of compiledHazards) {
              const overlay = hazard.evaluate(i, synthTable);
              const aT = overlay[3] / 255;
              if (aT > 0) {
                const it = 1 - aT;
                rgba = [
                  Math.round(rgba[0] * it + overlay[0] * aT),
                  Math.round(rgba[1] * it + overlay[1] * aT),
                  Math.round(rgba[2] * it + overlay[2] * aT),
                  Math.max(rgba[3], overlay[3]),
                ];
              }
            }
            const featureForRender = props.flat
              ? ({ ...f, height: 0.5 } as FootprintTileFeature)
              : f;
            features.push({ feature: featureForRender, color: [rgba[0], rgba[1], rgba[2]] });
          }
        }
       }
      }

      if (cancelled || features.length === 0) {
        setGeom(null);
        return;
      }

      const refLng = (header.minLon + header.maxLon) / 2;
      const refLat = (header.minLat + header.maxLat) / 2;
      const [refX, refY] = lngLatToMercatorMeters(refLng, refLat);
      const built = buildMesh(features, refX, refY);
      setGeom({
        positions: built.positions,
        colors: built.colors,
        indices: built.indices,
        center: new THREE.Vector3(refX, 0, -refY),
      });
    })().catch((err) => {
      if (!cancelled) console.warn('[FootprintLayer] failed to load PMTiles', err);
    });
    return () => {
      cancelled = true;
      if (ctx?.runtime) {
        for (const uri of registeredRef.current) ctx.runtime.unregisterFootprintTile(uri);
        registeredRef.current = [];
      }
    };
  }, [pmtilesUrl, zoom, visible, compiledColor, compiledHazards, ctx?.runtime, props.flat]);

  if (!geom || !visible) return <group />;

  return (
    <mesh frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[geom.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[geom.colors, 3, true]}
        />
        <bufferAttribute
          attach="index"
          args={[geom.indices, 1]}
        />
      </bufferGeometry>
      <meshStandardMaterial vertexColors transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}
