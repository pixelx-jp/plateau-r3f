import { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import {
  Plateau,
  HazardLayer,
  type ArtifactResolver,
  type BuiltinColorBy,
  type HazardType,
  type PlateauRuntimeApi,
} from '@plateau/r3f';

function DebugBridge() {
  const { scene, camera, gl } = useThree();
  (window as unknown as { __plateauDebug: unknown }).__plateauDebug = { scene, camera, gl };
  return null;
}

// In dev, vite middleware proxies /plateau-data → local plateau-core/out_*.
// In production (deployed demo), point at the R2 bucket where chiyoda's
// artifacts are at the bucket root (no /city/ prefix).
const FLAT_BASE_URL =
  (import.meta as unknown as { env: Record<string, string> }).env.VITE_PLATEAU_FLAT_BASE_URL;
const BASE_URL =
  (import.meta as unknown as { env: Record<string, string> }).env.VITE_PLATEAU_BASE_URL ??
  '/plateau-data';

// Custom resolver for the demo: when FLAT_BASE_URL is set, ignore the
// city argument and serve directly from the bucket root.
const flatResolver: ArtifactResolver | undefined = FLAT_BASE_URL
  ? {
      resolve() {
        const b = FLAT_BASE_URL!.replace(/\/$/, '');
        return {
          manifestUrl: `${b}/manifest.json`,
          tilesetUrl: `${b}/3dtiles/tileset.json`,
          tileIndexUrl: `${b}/tile_index.json`,
          pmtilesUrl: `${b}/buildings.pmtiles`,
        };
      },
    }
  : undefined;

const COLOR_BYS: BuiltinColorBy[] = ['year_built', 'structure', 'height'];
const HAZARDS: HazardType[] = ['river_flood', 'tsunami', 'storm_surge', 'landslide'];

function readCity(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get('city') ?? 'chiyoda';
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
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && mesh.geometry) {
          mesh.updateWorldMatrix(true, false);
          box.expandByObject(mesh);
          any = true;
        }
      });
      if (!any || box.isEmpty()) return;
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length();
      const dist = size * 0.7;
      camera.position.set(center.x + dist, center.y + dist, center.z + dist);
      camera.near = Math.max(1, size / 1000);
      camera.far = size * 100;
      camera.updateProjectionMatrix();
      camera.lookAt(center);
      fitted.current = true;
      clearInterval(id);
    }, 300);
    return () => clearInterval(id);
  }, [runtime, camera, scene]);

  return null;
}

export default function App() {
  const [colorBy, setColorBy] = useState<BuiltinColorBy>('height');
  const [hazard, setHazard] = useState<HazardType | 'none'>('river_flood');
  const [runtime, setRuntime] = useState<PlateauRuntimeApi | null>(null);
  const city = readCity();

  return (
    <>
      <div className="hud">
        <label>
          colorBy{' '}
          <select value={colorBy} onChange={(e) => setColorBy(e.target.value as BuiltinColorBy)}>
            {COLOR_BYS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        &nbsp;
        <label>
          hazard{' '}
          <select value={hazard} onChange={(e) => setHazard(e.target.value as HazardType | 'none')}>
            <option value="none">none</option>
            {HAZARDS.map((h) => (
              <option key={h} value={h}>
                {h}
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
          baseUrl={BASE_URL}
          resolver={flatResolver}
          colorBy={colorBy}
          onReady={setRuntime}
        >
          {hazard !== 'none' && <HazardLayer type={hazard} opacity={0.6} />}
        </Plateau>
        <AutoFitCamera runtime={runtime} />
        <OrbitControls makeDefault />
      </Canvas>
      <div className="attr">© Project PLATEAU / MLIT — CC BY 4.0</div>
    </>
  );
}
