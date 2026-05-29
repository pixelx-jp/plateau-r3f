# colorBy + hazard composition

The runtime composes one RGBA `DataTexture` per tile, indexed by `feature_id`. The shader does a single `texture2D` lookup per fragment.

## Compositing rule

```text
base  = colorBy(attrs)            // always opaque
for each HazardLayer in children order:
  overlay = hazardColor(layer, attrs)
  base.rgb = mix(base.rgb, overlay.rgb, overlay.a)
  base.a   = max(base.a, overlay.a)
```

Later `<HazardLayer>` children win visually.

## Hazard semantics

| condition | result |
| --- | --- |
| `covered=false`  | **no overlay** — keep `colorBy` (hazard has no data) |
| `covered=true && depth_max=null` | half-opacity safe color — surveyed clear |
| `covered=true && depth_max > 0` | depth ramp at full opacity |
| `covered=true && landslide_in_zone=false` | safe color |
| `covered=true && landslide_in_zone=true` | warning color |

This avoids the common bug of conflating "no data" with "no risk".

## Built-in `colorBy`

| value | source |
| --- | --- |
| `'year_built'` | linear ramp 1900 → 2020 |
| `'structure'`  | categorical {RC, SRC, S, W, CB, Other} |
| `'height'`     | linear ramp 0–120 m |
| `'river_flood' \| 'inland_flood' \| 'tsunami' \| 'storm_surge'` | depth ramp |
| `'landslide'`  | categorical in_zone {true, false} |

You can also pass:

- `{ field: 'floors', ramp: { type: 'linear', stops: [...] } }` for arbitrary fields.
- A function `(attrs) => Color` for fully custom logic. Called only when textures rebuild, never per-frame.
