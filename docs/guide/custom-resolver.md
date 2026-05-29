# Custom artifact resolver

The default resolver assumes `<baseUrl>/<city>/manifest.json` etc. Override it for non-standard layouts:

```ts
import { Plateau, type ArtifactResolver } from '@yodolabs/plateau-r3f';

const resolver: ArtifactResolver = {
  resolve(city) {
    return {
      manifestUrl: `https://cdn.example.com/plateau/${city}.v3/manifest.json`,
      tilesetUrl: `https://cdn.example.com/plateau/${city}.v3/3dtiles/tileset.json`,
      tileIndexUrl: `https://cdn.example.com/plateau/${city}.v3/tile_index.json`,
      pmtilesUrl: `https://cdn.example.com/plateau/${city}.v3/buildings.pmtiles`,
    };
  },
};

<Plateau city="chiyoda" resolver={resolver} colorBy="height" />
```

The resolver's only contract is the four URLs above. `baseUrl` (for joining `styleDir` and per-tile arrow paths) is derived from `manifestUrl`'s parent directory; `styleDir` defaults to `<baseUrl>/style` unless `manifest.artifacts.style_dir` says otherwise.

If your manifest explicitly says 3D Tiles aren't ready yet, set `manifest.artifacts.tiles_available = false` and the runtime will go straight to the PMTiles fallback path.
