# Quick start

```tsx
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Plateau, HazardLayer } from '@plateau/r3f';

export default function App() {
  return (
    <Canvas camera={{ position: [1500, 1500, 1500], near: 1, far: 1_000_000 }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[1000, 2000, 500]} intensity={1.0} />
      <Plateau
        city="chiyoda"
        baseUrl="https://your-cdn.example.com/plateau"
        colorBy="height"
      >
        <HazardLayer type="river_flood" opacity={0.6} />
      </Plateau>
      <OrbitControls makeDefault />
    </Canvas>
  );
}
```

When `<Plateau>` mounts:

1. `manifest.json` + `tile_index.json` are fetched.
2. `cesium-3d-tiles-renderer` is created and `ReorientationPlugin` recenters the tileset at world origin in Y-up.
3. Each loaded tile triggers an Arrow style fetch keyed by `tile_content_uri`.
4. A per-tile RGBA DataTexture is composed (colorBy ∘ hazard overlays).
5. The tile's material `onBeforeCompile` is patched to look up colors by `feature_id`.

Everything else — opacity, swapping `colorBy`, mounting more `<HazardLayer>` children — only rebuilds DataTextures, never geometry.
