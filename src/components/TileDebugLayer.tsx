import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { usePlateauContext } from '../hooks/usePlateauContext';
import type { TileLifecycleState } from '../core/TileLifecycle';

interface TileDebugLayerProps {
  /** Show only tiles in these states (default: all non-disposed). */
  states?: TileLifecycleState[];
  /** Box edge color. */
  color?: THREE.ColorRepresentation;
  /** Box opacity. */
  opacity?: number;
  /** Polling interval in ms (default 500). */
  pollMs?: number;
}

interface DebugBox {
  uri: string;
  state: TileLifecycleState;
  bbox: THREE.Box3;
}

/**
 * Renders a translucent wireframe box for each loaded tile, colored by its
 * lifecycle state. Useful for verifying:
 *  - tile_content_uri normalization is consistent
 *  - feature_id detection on tile geometries
 *  - which tiles entered which lifecycle state
 *
 * Mount inside `<Plateau>`.
 */
export function TileDebugLayer(props: TileDebugLayerProps): JSX.Element | null {
  const { runtime } = usePlateauContext();
  const [boxes, setBoxes] = useState<DebugBox[]>([]);
  const states = props.states;
  const pollMs = props.pollMs ?? 500;

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const next: DebugBox[] = [];
      runtime.group.traverse((obj) => {
        const handle = (obj.userData as { plateauHandle?: { tile_content_uri: string; state: TileLifecycleState } })
          .plateauHandle;
        if (!handle) return;
        if (states && !states.includes(handle.state)) return;
        const box = new THREE.Box3().setFromObject(obj);
        if (box.isEmpty()) return;
        next.push({ uri: handle.tile_content_uri, state: handle.state, bbox: box });
      });
      setBoxes(next);
    };
    tick();
    const id = setInterval(tick, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [runtime, pollMs, states]);

  if (boxes.length === 0) return null;

  return (
    <group>
      {boxes.map((b) => {
        const size = b.bbox.getSize(new THREE.Vector3());
        const center = b.bbox.getCenter(new THREE.Vector3());
        const tint = stateColor(b.state, props.color);
        return (
          <mesh
            key={b.uri}
            position={[center.x, center.y, center.z]}
            scale={[size.x, size.y, size.z]}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial
              color={tint}
              wireframe
              transparent
              opacity={props.opacity ?? 0.7}
              depthTest={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function stateColor(
  state: TileLifecycleState,
  override?: THREE.ColorRepresentation,
): THREE.ColorRepresentation {
  if (override) return override;
  switch (state) {
    case 'discovered':
    case 'geometryLoaded':
      return '#888888';
    case 'featureIdDetected':
    case 'styleRequested':
    case 'styleLoaded':
    case 'colorTextureReady':
      return '#ffcc44';
    case 'shaderInjected':
    case 'visible':
      return '#44ff88';
    case 'hidden':
      return '#666666';
    case 'featureIdMissing':
      return '#ff4444';
    case 'disposed':
      return '#222222';
  }
}
