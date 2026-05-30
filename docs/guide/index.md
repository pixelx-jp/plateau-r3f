# Overview

`@yodolabs/plateau-r3f` is a React Three Fiber library that consumes the artifacts produced by [`plateau-bridge`](https://github.com/pixelx-jp/plateau-bridge):

```
out_<city>/
  manifest.json
  tile_index.json
  3dtiles/tileset.json
  3dtiles/<z>/<x>/<y>_bldg_Building.glb
  style/<urlencoded(tile_content_uri)>.arrow
  buildings.pmtiles
```

It does three things you can't get from `cesium-3d-tiles-renderer` alone:

1. **Per-building attribute coloring** — render colors driven by `year_built`, `structure`, `height`, or PLATEAU hazard depths.
2. **Hazard layer composition** — flood / tsunami / storm-surge / landslide overlays with correct `covered=false` (no data) vs. `covered=true && depth=null` (surveyed safe) semantics.
3. **Graceful fallback** — when 3D Tiles lack feature ids or aren't available, transparently switch to PMTiles extrusion (Level 2) or flat plates (Level 3).

The library never reaches back to PLATEAU's CMS — every byte it consumes is something `plateau-bridge` already produced. Try it: [live demo with 29 cities](https://plateau-r3f-demo.pages.dev).
