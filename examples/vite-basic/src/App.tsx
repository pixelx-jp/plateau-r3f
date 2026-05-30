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
} from '@yodolabs/plateau-r3f';
import { ColorLegend } from './ColorLegend';

function DebugBridge() {
  const { scene, camera, gl } = useThree();
  (window as unknown as { __plateauDebug: unknown }).__plateauDebug = { scene, camera, gl };
  return null;
}

// In dev, vite middleware proxies /plateau-data → local plateau-core/out_*.
// In production, point at the R2 bucket. chiyoda lives at the bucket root
// (legacy); other cities at /<city>/.
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
  { id: 'adachi', label: 'Adachi · 足立' },
  { id: 'arakawa', label: 'Arakawa · 荒川' },
  { id: 'bunkyo', label: 'Bunkyō · 文京' },
  { id: 'chiyoda', label: 'Chiyoda · 千代田' },
  { id: 'chuo', label: 'Chūō · 中央' },
  { id: 'edogawa', label: 'Edogawa · 江戸川' },
  { id: 'itabashi', label: 'Itabashi · 板橋' },
  { id: 'katsushika', label: 'Katsushika · 葛飾' },
  { id: 'kita', label: 'Kita · 北' },
  { id: 'koto', label: 'Kōtō · 江東' },
  { id: 'meguro', label: 'Meguro · 目黒' },
  { id: 'minato', label: 'Minato · 港' },
  { id: 'nakano', label: 'Nakano · 中野' },
  { id: 'nerima', label: 'Nerima · 練馬' },
  { id: 'ota', label: 'Ōta · 大田' },
  { id: 'setagaya', label: 'Setagaya · 世田谷' },
  { id: 'shibuya', label: 'Shibuya · 渋谷' },
  { id: 'shinagawa', label: 'Shinagawa · 品川' },
  { id: 'shinjuku', label: 'Shinjuku · 新宿' },
  { id: 'suginami', label: 'Suginami · 杉並' },
  { id: 'sumida', label: 'Sumida · 墨田' },
  { id: 'taito', label: 'Taitō · 台東' },
  { id: 'toshima', label: 'Toshima · 豊島' },
  { id: 'fukuoka', label: 'Fukuoka · 福岡' },
  { id: 'kamakura', label: 'Kamakura · 鎌倉' },
  { id: 'nagoya', label: 'Nagoya · 名古屋' },
  { id: 'osaka', label: 'Osaka · 大阪' },
  { id: 'sapporo', label: 'Sapporo · 札幌' },
  { id: 'yokohama', label: 'Yokohama · 横浜' },
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

type LoadPhase =
  | 'manifest'
  | 'tile_index'
  | 'tileset'
  | 'tiles'
  | 'styles'
  | 'shading'
  | 'ready';

const PHASE_LABELS: Record<LoadPhase, string> = {
  manifest: 'Fetching manifest',
  tile_index: 'Reading tile index',
  tileset: 'Loading 3D tileset',
  tiles: 'Streaming 3D tiles',
  styles: 'Decoding attribute tables',
  shading: 'Patching shaders',
  ready: '',
};

function parseInitial(): { city: string; colorBy: BuiltinColorBy; hazard: HazardType | 'none' } {
  const p = new URLSearchParams(window.location.search);
  const city = p.get('city');
  const cb = p.get('colorBy') as BuiltinColorBy | null;
  const hz = p.get('hazard') as HazardType | 'none' | null;
  return {
    city: CITIES.some((x) => x.id === city) ? city! : 'chiyoda',
    colorBy: COLOR_BYS.some((x) => x.id === cb) ? cb! : 'height',
    hazard: HAZARDS.some((x) => x.id === hz) ? hz! : 'river_flood',
  };
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

export default function App() {
  const initial = useMemo(parseInitial, []);
  const [colorBy, setColorBy] = useState<BuiltinColorBy>(initial.colorBy);
  const [hazard, setHazard] = useState<HazardType | 'none'>(initial.hazard);
  const [city, setCity] = useState<string>(initial.city);
  const [runtime, setRuntime] = useState<PlateauRuntimeApi | null>(null);
  const [phase, setPhase] = useState<LoadPhase>('manifest');
  const [shareTip, setShareTip] = useState<string>('');

  const resolver = useMemo(() => makeR2Resolver(city), [city]);

  // Reflect all state in URL so it's shareable.
  useEffect(() => {
    const url = new URL(window.location.href);
    const setDefault = (k: string, v: string, def: string) => {
      if (v === def) url.searchParams.delete(k);
      else url.searchParams.set(k, v);
    };
    setDefault('city', city, 'chiyoda');
    setDefault('colorBy', colorBy, 'height');
    setDefault('hazard', hazard, 'river_flood');
    window.history.replaceState({}, '', url.toString());
  }, [city, colorBy, hazard]);

  // Track loading phases via fetch interception.
  useEffect(() => {
    setPhase('manifest');
    const orig = window.fetch.bind(window);
    let firstStyle = false;
    let firstGlb = false;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const u = args[0];
      const url = typeof u === 'string' ? u : u instanceof URL ? u.toString() : (u as Request).url ?? '';
      if (url.endsWith('tile_index.json')) setPhase((p) => (p === 'manifest' ? 'tile_index' : p));
      else if (url.endsWith('tileset.json')) setPhase((p) => (p === 'manifest' || p === 'tile_index' ? 'tileset' : p));
      else if (url.endsWith('.glb') && !firstGlb) {
        firstGlb = true;
        setPhase((p) => (p !== 'ready' && p !== 'shading' && p !== 'styles' ? 'tiles' : p));
      } else if (url.endsWith('.arrow') && !firstStyle) {
        firstStyle = true;
        setPhase((p) => (p !== 'ready' && p !== 'shading' ? 'styles' : p));
      }
      return orig(...args);
    };
    return () => {
      window.fetch = orig;
    };
  }, [city, resolver]);

  // Promote to "shading" / "ready" via runtime observation.
  useEffect(() => {
    if (!runtime) return;
    let cancelled = false;
    let stableTicks = 0;
    let lastCount = 0;
    const id = setInterval(() => {
      if (cancelled) return;
      const visible = runtime.queryVisibleBuildings();
      if (visible.length === 0) return;
      setPhase((p) => (p === 'ready' || p === 'shading' ? p : 'shading'));
      if (visible.length === lastCount) stableTicks++;
      else stableTicks = 0;
      lastCount = visible.length;
      if (stableTicks >= 2) {
        setPhase('ready');
        clearInterval(id);
      }
    }, 1500);
    const fallback = setTimeout(() => {
      setPhase('ready');
      clearInterval(id);
    }, 45_000);
    return () => {
      cancelled = true;
      clearInterval(id);
      clearTimeout(fallback);
    };
  }, [runtime]);

  // Hide the boot loading overlay once we declare ready.
  useEffect(() => {
    const el = document.getElementById('loading');
    if (!el) return;
    if (phase === 'ready') el.classList.add('hidden');
    else el.classList.remove('hidden');
  }, [phase]);

  // Show the phase label on the boot overlay while it's still visible.
  useEffect(() => {
    const lbl = document.querySelector('#loading .label');
    if (lbl) lbl.textContent = phase === 'ready' ? '' : PHASE_LABELS[phase];
  }, [phase]);

  const shareUrl = () => {
    const url = window.location.href;
    void navigator.clipboard.writeText(url).then(
      () => {
        setShareTip('Link copied');
        setTimeout(() => setShareTip(''), 1800);
      },
      () => {
        setShareTip('Copy failed');
        setTimeout(() => setShareTip(''), 1800);
      },
    );
  };

  return (
    <>
      <div className="brand">
        <span className="dot" />
        <span className="name">@yodolabs/plateau-r3f</span>
        <span className="pkg">demo</span>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Demo controls</h2>
          <button className="share" onClick={shareUrl} title="Copy shareable URL">
            {shareTip || 'Share'}
          </button>
        </div>

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

        <ColorLegend colorBy={colorBy} hazard={hazard} />

        {phase !== 'ready' && (
          <div className="phase">
            <span className="phase-dot" />
            {PHASE_LABELS[phase]}…
          </div>
        )}
      </div>

      <Canvas camera={{ position: [1500, 1500, 1500], near: 1, far: 1_000_000, fov: 50 }}>
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
            @yodolabs/plateau-r3f
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
