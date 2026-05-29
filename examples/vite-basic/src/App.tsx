import { useState, useEffect, useMemo, useRef } from 'react';
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
// In production (deployed demo), point at the R2 bucket. Chiyoda lives at the
// bucket root (legacy); other cities at /<city>/.
const FLAT_BASE_URL =
  (import.meta as unknown as { env: Record<string, string> }).env.VITE_PLATEAU_FLAT_BASE_URL;
const BASE_URL =
  (import.meta as unknown as { env: Record<string, string> }).env.VITE_PLATEAU_BASE_URL ??
  '/plateau-data';

function makeR2Resolver(city: string): ArtifactResolver | undefined {
  if (!FLAT_BASE_URL) return undefined;
  const root = FLAT_BASE_URL.replace(/\/$/, '');
  const prefix = city === 'chiyoda' ? root : `${root}/${city}`;
  return {
    resolve() {
      return {
        manifestUrl: `${prefix}/manifest.json`,
        tilesetUrl: `${prefix}/3dtiles/tileset.json`,
        tileIndexUrl: `${prefix}/tile_index.json`,
        pmtilesUrl: `${prefix}/buildings.pmtiles`,
      };
    },
  };
}

interface CityDef {
  id: string;
  label: string;
}

const CITIES: CityDef[] = [
  { id: 'chiyoda', label: 'Chiyoda · 千代田' },
  { id: 'minato', label: 'Minato · 港' },
  { id: 'kamakura', label: 'Kamakura · 鎌倉' },
];

const COLOR_BYS: { id: BuiltinColorBy; label: string }[] = [
  { id: 'height', label: 'Height' },
  { id: 'year_built', label: 'Year built' },
  { id: 'structure', label: 'Structure' },
];

const HAZARDS: { id: HazardType | 'none'; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'river_flood', label: 'River flood' },
  { id: 'inland_flood', label: 'Inland flood' },
  { id: 'tsunami', label: 'Tsunami' },
  { id: 'storm_surge', label: 'Storm surge' },
  { id: 'landslide', label: 'Landslide' },
];

function readCity(): string {
  const params = new URLSearchParams(window.location.search);
  const c = params.get('city');
  return CITIES.some((x) => x.id === c) ? c! : 'chiyoda';
}

function AutoFitCamera({ runtime }: { runtime: PlateauRuntimeApi | null }) {
  const { camera, scene } = useThree();
  const fitted = useRef(false);

  useEffect(() => {
    fitted.current = false;
  }, [runtime]);

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

function hideLoadingSoon() {
  const el = document.getElementById('loading');
  if (!el) return;
  // Delay a beat so the canvas has a chance to render at least one frame.
  setTimeout(() => el.classList.add('hidden'), 600);
}

export default function App() {
  const [colorBy, setColorBy] = useState<BuiltinColorBy>('height');
  const [hazard, setHazard] = useState<HazardType | 'none'>('river_flood');
  const [city, setCity] = useState<string>(readCity());
  const [runtime, setRuntime] = useState<PlateauRuntimeApi | null>(null);

  const resolver = useMemo(() => makeR2Resolver(city), [city]);

  // Update URL when city changes so it's shareable.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (city === 'chiyoda') url.searchParams.delete('city');
    else url.searchParams.set('city', city);
    window.history.replaceState({}, '', url.toString());
  }, [city]);

  return (
    <>
      <div className="brand">
        <span className="dot" />
        <span className="name">@plateau/r3f</span>
        <span className="pkg">demo</span>
      </div>

      <div className="panel">
        <h2>Demo controls</h2>
        <div className="row">
          <label htmlFor="city">City</label>
          <select id="city" value={city} onChange={(e) => setCity(e.target.value)}>
            {CITIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="row">
          <label htmlFor="colorby">Color by</label>
          <select
            id="colorby"
            value={colorBy}
            onChange={(e) => setColorBy(e.target.value as BuiltinColorBy)}
          >
            {COLOR_BYS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="row">
          <label htmlFor="hazard">Hazard</label>
          <select
            id="hazard"
            value={hazard}
            onChange={(e) => setHazard(e.target.value as HazardType | 'none')}
          >
            {HAZARDS.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Canvas
        camera={{ position: [1500, 1500, 1500], near: 1, far: 1_000_000, fov: 50 }}
        onCreated={hideLoadingSoon}
      >
        <DebugBridge />
        <ambientLight intensity={0.6} />
        <directionalLight position={[1000, 2000, 500]} intensity={1.0} />
        <Plateau
          key={city}
          city={city}
          baseUrl={BASE_URL}
          resolver={resolver}
          colorBy={colorBy}
          onReady={setRuntime}
        >
          {hazard !== 'none' && <HazardLayer type={hazard} opacity={0.6} />}
        </Plateau>
        <AutoFitCamera runtime={runtime} />
        <OrbitControls makeDefault />
      </Canvas>

      <div className="attr">
        © Project PLATEAU / MLIT — CC BY 4.0
        <div className="links">
          Built with{' '}
          <a href="https://github.com/pixelx-jp/plateau-r3f" target="_blank" rel="noreferrer">
            @plateau/r3f
          </a>
          <span className="sep">·</span>
          <a href="https://pixelx-jp.github.io/plateau-r3f/" target="_blank" rel="noreferrer">
            Docs
          </a>
          <span className="sep">·</span>
          <a href="https://yodolabs.jp" target="_blank" rel="noreferrer">
            Yodo Labs
          </a>
        </div>
      </div>
    </>
  );
}
