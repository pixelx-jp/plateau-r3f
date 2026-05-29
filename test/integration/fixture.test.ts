import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures');
const FIXTURE_DIR = path.join(FIXTURE_ROOT, 'mini-city');

// Serve fixture files via a fetch mock.
beforeAll(() => {
  const orig = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request) => {
    const s = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    const rel = s.replace(/^https?:\/\/[^/]+\//, '').replace(/^fixture:\/+/, '');
    const filePath = path.join(FIXTURE_ROOT, rel);
    if (!fs.existsSync(filePath)) {
      return new Response('not found', { status: 404 });
    }
    const buf = fs.readFileSync(filePath);
    const contentType = filePath.endsWith('.json')
      ? 'application/json'
      : filePath.endsWith('.arrow')
      ? 'application/octet-stream'
      : 'application/octet-stream';
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: { 'content-type': contentType },
    });
  }) as typeof fetch;

  return () => {
    globalThis.fetch = orig;
  };
});

describe('mini-city fixture: ManifestLoader + StyleTableCache + TileColorizer', () => {
  it('loads manifest and tile_index from fixture', async () => {
    const { loadArtifacts, defaultResolver } = await import('../../src/core/ManifestLoader');
    const set = await loadArtifacts(defaultResolver('fixture://'), 'mini-city');
    expect(set.artifacts.manifest.city_name).toBe('mini-city');
    expect(Object.keys(set.tileIndex)).toHaveLength(1);
    expect(set.tileIndex['0/0/0_bldg_Building.glb']).toContain('.arrow');
  });

  it('StyleTableCache.get returns a usable StyleTable', async () => {
    const { loadArtifacts, defaultResolver } = await import('../../src/core/ManifestLoader');
    const { createStyleTableCache } = await import('../../src/style/StyleTableCache');
    const { joinUrl } = await import('../../src/utils/uri');

    const set = await loadArtifacts(defaultResolver('fixture://'), 'mini-city');
    const cache = createStyleTableCache({
      resolveUrl: (uri) => {
        const rel = set.tileIndex[uri];
        if (!rel) return undefined;
        return joinUrl(set.artifacts.baseUrl, rel);
      },
    });
    const table = await cache.get('0/0/0_bldg_Building.glb');
    expect(table.featureCount).toBe(2);
    expect(table.getNumber(0, 'year_built')).toBe(1985);
    expect(table.getNumber(1, 'height')).toBe(30);
    expect(table.getBoolean(1, 'river_flood_covered')).toBe(true);
  });

  it('builds a color texture from the fixture honoring colorBy + hazard overlay', async () => {
    const { createStyleTable } = await import('../../src/style/StyleTable');
    const { compileColorBy } = await import('../../src/style/colorBy');
    const { compileHazardLayer } = await import('../../src/hazards/hazardColor');
    const { buildTileColorTexture } = await import('../../src/style/TileColorizer');
    const { tableFromIPC } = await import('apache-arrow');

    const arrowBytes = fs.readFileSync(
      path.join(FIXTURE_DIR, 'style', '0%2F0%2F0_bldg_Building.glb.arrow'),
    );
    const arrowTable = tableFromIPC(new Uint8Array(arrowBytes));
    const styleTable = createStyleTable(arrowTable, '0/0/0_bldg_Building.glb');

    const colorBy = compileColorBy('height', '#000000');
    const hazardLayer = compileHazardLayer({
      id: 'l1',
      type: 'river_flood',
      visible: true,
      opacity: 0.6,
    });

    const tex = buildTileColorTexture({
      table: styleTable,
      colorBy,
      layers: [hazardLayer],
    });

    const data = tex.texture.image.data as Uint8Array;
    // fid 0: river_flood_covered=true, depth=0 → safe (no overlay strong)
    // fid 1: river_flood_covered=true, depth=2.5 → blue overlay over base height color
    expect(data.length).toBeGreaterThanOrEqual(8);
    // Both feature ids should have full base alpha (colorBy is opaque)
    expect(data[3]).toBe(255);
    expect(data[7]).toBe(255);
    // The two cells should not be identical (different heights + hazard state)
    const a = [data[0], data[1], data[2]];
    const b = [data[4], data[5], data[6]];
    expect(a).not.toEqual(b);
  });
});
