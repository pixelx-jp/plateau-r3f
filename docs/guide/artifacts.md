# Artifacts layout

`baseUrl` is a directory whose contents match what [`plateau-bridge`](https://github.com/pixelx-jp/plateau-bridge) produces:

```
<baseUrl>/<city>/
  manifest.json                       (n_buildings, sources, coverage stats)
  tile_index.json                     ({ tile_content_uri: 'style/<encoded>.arrow' })
  3dtiles/tileset.json
  3dtiles/<z>/<x>/<y>_bldg_Building.glb
  style/<urlencoded(tile_content_uri)>.arrow
  buildings.pmtiles                   (optional; only needed for fallback / overview)
```

Every `tile_content_uri` (the relative URI inside `tileset.json`) MUST appear in `tile_index.json` and have a matching `style/*.arrow`. The arrow file contains one row per building with at minimum a `tile_feature_id` column matching the `_FEATURE_ID_0` / `_BATCHID` attribute on the GLB.

Hazard fields use the PLATEAU pipeline naming:

```
<type>_covered, <type>_coverage_source_ids, <type>_hit_source_ids,
<type>_coverage_confidence, <type>_depth_max | <type>_in_zone
```

with `<type>` ∈ `river_flood | inland_flood | tsunami | storm_surge | landslide`.

If you need a non-standard URL scheme (S3 paths, signed CDN, etc.) provide a custom `resolver` — see [Custom resolver](./custom-resolver).
