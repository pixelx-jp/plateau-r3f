# Fallback levels

```text
Level 0   3D Tiles + Arrow style + shader color
Level 1   3D Tiles original material (no style)
Level 2   PMTiles footprint extrusion with style color
Level 3   PMTiles flat plates
off       render nothing
```

Set the policy on `<Plateau fallback="...">`:

| policy | behavior |
| --- | --- |
| `'auto'` (default) | pick the highest-quality level the data supports |
| `'force-3dtiles'`  | prefer 3D Tiles; degrades 0 → 1 if feature ids missing |
| `'force-footprint'` | always render PMTiles fallback |
| `'off'` | render nothing |

The runtime resolves to a concrete `FallbackMode` automatically. Mount `<FallbackExtrusionLayer>` inside `<Plateau>` to have the PMTiles path auto-mount when the mode is `level-2-pmtiles-extruded` or `level-3-pmtiles-flat`.

```tsx
import { Plateau, FallbackExtrusionLayer } from '@plateau/r3f';

<Plateau city="..." fallback="auto">
  <FallbackExtrusionLayer />
</Plateau>
```

## Triggers

The runtime drops to a lower level when:

- `manifest.artifacts.tiles_available === false`
- `manifest.artifacts.style_available === false`
- any tile geometry has no `_FEATURE_ID_0` / `_BATCHID` attribute
- a `style/*.arrow` request fails

You're notified via `onError`; the lifecycle state for that tile becomes `featureIdMissing`.
