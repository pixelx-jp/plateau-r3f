# Contributing to @yodolabs/plateau-r3f

## Setup

```sh
npm install
npm run typecheck
npm test
npm run build
# Enable the pre-commit hook that blocks AI-assistant scratch + secrets:
git config core.hooksPath .githooks
```

## Don't commit

The repo is open source. **Never commit**:

- AI assistant scratch: `.claude/`, `CLAUDE.md`, `.cursor/`, `.cursorrules`, `.aider*`, `.continue/`, `.codeium*`, `.windsurf/`
- Secrets: `.env*`, `*.local`, anything containing API keys / tokens
- PLATEAU artifact directories: `out_*/`, `plateau-data/`
- Personal absolute paths

These are excluded by `.gitignore`, blocked by the pre-commit hook (above), and double-checked by CI (`.github/workflows/ci.yml`). If you bypass one layer (e.g. `git add -f`), the next layer will still catch it before publish.

## Running the example

The `examples/vite-basic` app expects `plateau-core` artifacts at `../../plateau-core/out_<city>/`. Generate them first per the `plateau-core` README, then:

```sh
cd examples/vite-basic
npm install
npm run dev
```

The Vite dev config wires `/plateau-data/<city>/...` to `plateau-core/out_<city>/...` on disk.

## Browser render check (optional)

```sh
npx playwright install chromium    # one-time
cd examples/vite-basic && npm run dev   # in another terminal
node test/browser/render.mjs
```

Asserts: tileset.json loaded, ≥1 GLB and ≥1 .arrow downloaded, ≥1 mesh in scene, screenshot has non-trivial coverage.

## What lives where

| Concern | Module |
| --- | --- |
| 3D Tiles event bridge | `core/TilesetController.ts` |
| Manifest + tile_index | `core/ManifestLoader.ts` |
| Orchestration | `core/PlateauRuntime.ts` |
| Per-tile Arrow access | `style/StyleTable.ts` |
| Cache + concurrency dedup | `style/StyleTableCache.ts` |
| colorBy compile | `style/colorBy.ts` |
| RGBA texture composition | `style/TileColorizer.ts` |
| 5 hazard field bindings | `hazards/hazardFields.ts` |
| Hazard ramps | `hazards/hazardColor.ts` |
| Custom hazards | `hazards/HazardLayerRegistry.ts` |
| GLSL hooks + patcher | `shader/ShaderInjector.ts` |
| Fallback decision | `fallback/FallbackController.ts` |
| MVT decode + Mercator | `footprint/*` |
| React surface | `components/`, `hooks/` |
| Light store | `store/` |

## Coding rules

- Don't introduce new public exports without adding them to `src/index.ts` AND `README.md`.
- Anything keyed by tile must use the full `tile_content_uri` string, not just a filename or numeric id.
- Texture lookups are indexed by `feature_id`, not by row — size textures with `featureIdMax`, not `featureCount`.
- `colorBy` is opaque (base); only `HazardLayer` may use alpha.
- Never decode or fetch in `useFrame`.

## Pre-PR checklist

- `npm run typecheck` clean
- `npm test` green
- `npm run build` clean (ESM + CJS + d.ts)
- New behavior covered by a unit test if testable
- `CHANGELOG.md` entry under `Unreleased`
