import { loadJson } from '../loaders/loadJson';
import type { Manifest, TileIndex } from '../types/public';
import { joinUrl } from '../utils/uri';

export interface ResolvedArtifacts {
  baseUrl: string;
  manifest: Manifest;
  manifestUrl: string;
  tilesetUrl: string;
  tileIndexUrl: string;
  pmtilesUrl?: string;
  styleDir: string;
}

export interface ResolvedSet {
  artifacts: ResolvedArtifacts;
  tileIndex: TileIndex;
}

/**
 * Per plan: the resolver returns only the four canonical URLs.
 * `baseUrl` and `styleDir` are derived internally (dirname of manifestUrl,
 * and `${baseUrl}/style` respectively) — they are NOT part of the public
 * resolver contract.
 */
export interface ArtifactResolver {
  resolve(city: string): {
    manifestUrl: string;
    tilesetUrl: string;
    tileIndexUrl: string;
    pmtilesUrl?: string;
  };
}

function deriveBaseUrl(manifestUrl: string): string {
  return manifestUrl.replace(/\/[^/]*$/, '');
}

export function defaultResolver(baseUrl?: string): ArtifactResolver {
  return {
    resolve(city) {
      const base = baseUrl ? joinUrl(baseUrl, city) : `out_${city}`;
      return {
        manifestUrl: joinUrl(base, 'manifest.json'),
        tilesetUrl: joinUrl(base, '3dtiles/tileset.json'),
        tileIndexUrl: joinUrl(base, 'tile_index.json'),
        pmtilesUrl: joinUrl(base, 'buildings.pmtiles'),
      };
    },
  };
}

export async function loadArtifacts(
  resolver: ArtifactResolver,
  city: string,
  signal?: AbortSignal,
): Promise<ResolvedSet> {
  const r = resolver.resolve(city);
  const baseUrl = deriveBaseUrl(r.manifestUrl);
  const manifest = await loadJson<Manifest>(r.manifestUrl, signal);

  // Manifest artifact paths take precedence over resolver defaults.
  const manifestArtifacts = manifest.artifacts ?? {};
  const tilesetUrl = manifestArtifacts.tileset
    ? joinUrl(baseUrl, manifestArtifacts.tileset)
    : r.tilesetUrl;
  const tileIndexUrl = manifestArtifacts.tile_index
    ? joinUrl(baseUrl, manifestArtifacts.tile_index)
    : r.tileIndexUrl;
  const pmtilesUrl = manifestArtifacts.pmtiles
    ? joinUrl(baseUrl, manifestArtifacts.pmtiles)
    : r.pmtilesUrl;
  const styleDir = manifestArtifacts.style_dir
    ? joinUrl(baseUrl, manifestArtifacts.style_dir)
    : joinUrl(baseUrl, 'style');

  // tile_index is optional — when 3D Tiles are unavailable we fall back to
  // PMTiles and never read per-tile arrows.
  let tileIndex: TileIndex = {};
  if (manifestArtifacts.tiles_available !== false) {
    try {
      tileIndex = await loadJson<TileIndex>(tileIndexUrl, signal);
    } catch (err) {
      // Non-fatal: caller's fallback policy may still produce a valid render.
      tileIndex = {};
    }
  }

  return {
    artifacts: {
      baseUrl,
      manifest,
      manifestUrl: r.manifestUrl,
      tilesetUrl,
      tileIndexUrl,
      pmtilesUrl,
      styleDir,
    },
    tileIndex,
  };
}
