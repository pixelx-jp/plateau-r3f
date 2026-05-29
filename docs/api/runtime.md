# Runtime

`<Plateau>` is the React wrapper around `PlateauRuntime`. Build a runtime directly when you need lifecycle control outside React (e.g. headless processing, custom orchestration).

```ts
import { createPlateauRuntime } from '@yodolabs/plateau-r3f';

const runtime = await createPlateauRuntime({
  city: 'chiyoda',
  baseUrl: 'https://cdn/.../plateau',
  initialColorPlan: {
    colorBy: 'height',
    opacity: 1,
    missingColor: '#bbbbbb',
    version: 1,
  },
  fallbackPolicy: 'auto',
});

scene.add(runtime.group);
runtime.setCamera(camera);
runtime.setResolutionFromRenderer(camera, renderer);

// In your render loop:
runtime.update();
```

## API

| method | description |
| --- | --- |
| `setColorPlan(plan)` | swap base coloring; rebuilds DataTextures, never geometry |
| `setHazardLayers(layers)` | swap active hazard overlays; same texture rebuild |
| `setFallbackPolicy(policy)` | change `'auto' \| 'force-3dtiles' \| 'force-footprint' \| 'off'` |
| `getBuilding(key)` | materialize one building's attributes |
| `queryVisibleBuildings(filter?)` | enumerate all visible buildings (3D Tiles + PMTiles fallback) |
| `getAttribution()` | per-dataset attribution records |
| `getFallbackMode()` | the resolved `FallbackMode` (level 0–3 or `'off'`) |
| `registerFootprintTile(uri, entries)` | inject `pmtiles://z/x/y` features (used internally by `<FootprintLayer>`) |
| `update()` | call once per frame |
| `dispose()` | tear down |

## `loadArtifacts(resolver, city, signal?)`

Lower-level — just resolves the URLs, fetches the manifest + tile_index, returns a `ResolvedSet`. Used by `createPlateauRuntime` but exposed for tooling.

## `defaultResolver(baseUrl?)`

The default `ArtifactResolver` that maps `<baseUrl>/<city>/...`.
