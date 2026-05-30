# Changelog

## 0.1.0 — Initial release

- `<Plateau>` component: loads `manifest.json` + `tile_index.json` + 3D Tiles + per-tile Arrow style tables, builds DataTexture lookup keyed by `feature_id`, patches `onBeforeCompile` on MeshStandard/Lambert/Phong/Basic/Toon/Physical materials.
- `colorBy`: `'year_built' | 'structure' | 'height' | HazardType`, `{ field, ramp }`, or function `(attrs) => Color`. Base color is always opaque; "missing" maps to `missingColor`.
- `<HazardLayer>`: 5 builtin types (`river_flood`, `inland_flood`, `tsunami`, `storm_surge`, `landslide`). Compositing respects `covered=false → no data`, `covered=true && depth=null → safe tint`.
- Runtime exposes `setColorPlan`, `setHazardLayers`, `getBuilding`, `queryVisibleBuildings`, `getAttribution`, `getFallbackMode`, `setFallbackPolicy`.
- `<FootprintLayer>` PMTiles → MVT decode → earcut extrusion → vertex-color mesh.
- `<FallbackExtrusionLayer>` auto-mounts footprints when runtime decides PMTiles fallback.
- Public extension APIs:
  - `registerHazardLayer({ type, valueField, ... })`
  - `Plateau resolver={...}` (custom `ArtifactResolver`)
  - `Plateau shaderExtensions={[...]}` (custom GLSL chunks via `ShaderExtension`)
- Auto-applied `ReorientationPlugin({ recenter: true, up: '+y' })` so PLATEAU tilesets render at world origin in Y-up.
- 25 unit tests across `StyleTable`, `StyleTableCache`, `ColorRamp`, `hazardFields`, `FallbackController`, `uri`.
- Headless Chromium render verification driving `examples/vite-basic` against Chiyoda artifacts.
- Multi-city validation across Chiyoda / Minato / Kamakura / Fukuoka / Nagoya — library loads tilesets and arrows with no failed requests on all five.
- Regression test for sparse `tile_feature_id` (non-contiguous ids, e.g. 0 / 5 / 380).
- GitHub Actions: CI on push/PR (typecheck + test + build + pack), Release workflow on `v*` tags (auto `npm publish --provenance`).

### Live demo

- Deployed at https://plateau-r3f-demo.pages.dev (Cloudflare Pages + R2).
- Multi-city: Chiyoda · Minato · Kamakura, with one-click switcher.
- Polished UI: glassmorphism control panel (city / colorBy / hazard), loading spinner, brand chip.
- `?city=<id>` URL param for shareable views.

### 0.1.3 — Bounded auto-retry from rebuildTile finally

- The visibility-driven retry from 0.1.1 only fires on the *transition*
  to visible. If a `rebuildTile` lost a `tileAlive` race mid-flight
  while the tile stayed visible, no further event fired to trigger
  another attempt. `rebuildTile`'s `finally` block now requeues one
  more attempt (up to `MAX_AUTO_RETRIES=3`) when the rebuild bailed
  without setting `colorTexture` and the tile is still alive + visible
  + not terminally failed. Counter resets on success.

### 0.1.2 — Robust rebuild gating + larger style cache

- Replaced `entry.handle.state`-based gating in `rebuildTile` with
  entry-local `terminallyFailed` / `rebuildInFlight` flags. Visibility
  events write to `state` ('visible'/'hidden'), which previously could
  clobber `'featureIdMissing'`/`'styleRequested'` and let permanent
  failures silently retry on every hide→visible cycle, or stack duplicate
  awaiters during LOD churn. (Found in code review.)
- `StyleTableCache` default `max` raised 256 → 4096 to comfortably cover
  large cities (Kamakura 2.7k tiles, Nagoya 22k). Visible tiles are
  pinned by refCount; only off-screen entries are eligible for eviction.

### 0.1.1 — Resilient styling on big cities

- Fix a race where `rebuildTile` could bail mid-flight (camera reframing
  caused 3D Tiles to evict a tile while its style arrow was still
  fetching), leaving the re-loaded mesh unstyled. The visibility callback
  now retries `rebuildTile` for any visible tile without a color texture.
  Minato (32k buildings) and Kamakura (69k) now render with full styling.

### Plan-conformance fixes (post-review)

- Extracted `core/TileLifecycle.ts` with `canTransition()` state-machine helper.
- `PlateauRuntime` now emits the full `styleRequested → styleLoaded → colorTextureReady → shaderInjected` chain; style load failure transitions to Level 1 fallback per-tile.
- `<TileDebugLayer>` added — wireframe boxes colored by lifecycle state.
- `store/selectors.ts` with `selectStatus / selectIsReady / selectWarnings / ...` exported as `selectors.*`.
- `<FloodLayer>` / `<InlandFloodLayer>` / `<TsunamiLayer>` / `<StormSurgeLayer>` / `<LandslideLayer>` thin aliases over `<HazardLayer type="...">`.
- `StyleTable.featureIdAt(row)` exposed; `CompiledColorBy.evaluate(row, table)` signature matches plan exactly (no extra `featureId` param).
- `Manifest.artifacts.tiles_available` / `style_available` flags drive fallback decision.
- PMTiles fallback registers synthetic `pmtiles://z/x/y` tiles into the runtime so `getBuilding` / `queryVisibleBuildings` work uniformly across both paths.
- `FallbackMode = 'level-3-pmtiles-flat'` actually renders flat plates (height = 0.5 m) via `<FootprintLayer flat />`.
- `examples/fallback-mode/` example added.
- `test/integration/` with `mini-city` fixture (manifest + tile_index + tileset.json + arrow + pmtiles stub) + fallback semantics test.
- `test/unit/ShaderInjector.test.ts` covers feature-id detection priority and `customProgramCacheKey` stability.
- `ArtifactResolver.resolve()` contract tightened to plan's 4 fields (`manifestUrl`, `tilesetUrl`, `tileIndexUrl`, `pmtilesUrl?`); `baseUrl` / `styleDir` derived internally.
- `FootprintLayerProps` carries the full public surface (`zoom`, `pmtilesUrl`, `flat`).
