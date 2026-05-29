import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  Plateau,
  FallbackExtrusionLayer,
  type FallbackPolicy,
  type PlateauRuntimeApi,
} from '@yodolabs/plateau-r3f';

function DebugBridge() {
  const { scene, camera, gl } = useThree();
  (window as unknown as { __plateauDebug: unknown }).__plateauDebug = { scene, camera, gl };
  return null;
}

function readCity(): string {
  return new URLSearchParams(window.location.search).get('city') ?? 'chiyoda';
}

function AutoFitCamera({ runtime }: { runtime: PlateauRuntimeApi | null }) {
  const { camera, scene } = useThree();
  const fitted = useRef(false);
  useEffect(() => {
    if (!runtime || fitted.current) return;
    const id = setInterval(() => {
      if (fitted.current) return;
      const box = new THREE.Box3();
      let any = false;
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.geometry) {
          m.updateWorldMatrix(true, false);
          box.expandByObject(m);
          any = true;
        }
      });
      if (!any || box.isEmpty()) return;
      const c = box.getCenter(new THREE.Vector3());
      const s = box.getSize(new THREE.Vector3()).length();
      const d = s * 0.7;
      camera.position.set(c.x + d, c.y + d, c.z + d);
      camera.near = Math.max(1, s / 1000);
      camera.far = s * 100;
      camera.updateProjectionMatrix();
      camera.lookAt(c);
      fitted.current = true;
      clearInterval(id);
    }, 300);
    return () => clearInterval(id);
  }, [runtime, camera, scene]);
  return null;
}

const POLICIES: FallbackPolicy[] = ['auto', 'force-3dtiles', 'force-footprint', 'off'];

export default function App() {
  const [policy, setPolicy] = useState<FallbackPolicy>('force-footprint');
  const [runtime, setRuntime] = useState<PlateauRuntimeApi | null>(null);
  const city = readCity();

  return (
    <>
      <div className="hud">
        <label>
          fallback{' '}
          <select value={policy} onChange={(e) => setPolicy(e.target.value as FallbackPolicy)}>
            {POLICIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Canvas camera={{ position: [1500, 1500, 1500], near: 1, far: 1_000_000, fov: 50 }}>
        <DebugBridge />
        <ambientLight intensity={0.6} />
        <directionalLight position={[1000, 2000, 500]} intensity={1.0} />
        <Plateau
          city={city}
          baseUrl="/plateau-data"
          colorBy={(attrs) =>
            attrs.river_flood_depth_max && attrs.river_flood_depth_max > 1
              ? '#d73027'
              : '#5896c9'
          }
          fallback={policy}
          onReady={setRuntime}
        >
          <FallbackExtrusionLayer />
        </Plateau>
        <AutoFitCamera runtime={runtime} />
        <OrbitControls makeDefault />
      </Canvas>
      <div className="attr">© Project PLATEAU / MLIT — CC BY 4.0</div>
    </>
  );
}
