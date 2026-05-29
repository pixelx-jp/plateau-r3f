---
layout: home
hero:
  name: '@yodolabs/plateau-r3f'
  text: PLATEAU 3D Tiles for React Three Fiber
  tagline: Per-building attribute coloring, hazard layers, and PMTiles fallback — built on artifacts from plateau-core.
  actions:
    - theme: brand
      text: Get started
      link: /guide/
    - theme: alt
      text: API reference
      link: /api/
features:
  - title: One-line 3D Tiles
    details: '<Plateau city="chiyoda" /> loads geometry, attribute tables, and hazard fields.'
  - title: Five built-in hazard types
    details: river_flood / inland_flood / tsunami / storm_surge / landslide with PLATEAU pipeline semantics.
  - title: Graceful fallback
    details: 'auto / force-3dtiles / force-footprint / off — falls back to PMTiles extrusion when 3D Tiles are missing or lack feature ids.'
  - title: Pluggable
    details: Custom ArtifactResolver, hazard layers, shader extensions, and Worker-backed Arrow decoders.
---
