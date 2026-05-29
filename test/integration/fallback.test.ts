import { describe, it, expect } from 'vitest';
import { decideFallback } from '../../src/fallback/FallbackController';
import {
  compileColorBy,
  type CompiledColorBy,
} from '../../src/style/colorBy';
import {
  buildTileColorTexture,
} from '../../src/style/TileColorizer';
import { createStyleTable } from '../../src/style/StyleTable';
import { tableFromArrays } from 'apache-arrow';

function tableWithCovered(covered: boolean | null) {
  return tableFromArrays({
    tile_feature_id: new Int32Array([0]),
    height: new Float64Array([10]),
    river_flood_covered:
      covered === null ? [null as unknown as boolean] : [covered],
    river_flood_depth_max: new Float64Array([2]),
  });
}

describe('fallback integration', () => {
  it('feature_id missing + pmtiles available → policy=auto picks Level 2', () => {
    expect(
      decideFallback({
        policy: 'auto',
        has3dTiles: true,
        hasFeatureIds: false,
        styleAvailable: true,
        pmtilesAvailable: true,
      }),
    ).toBe('level-2-pmtiles-extruded');
  });

  it('feature_id missing + no pmtiles → policy=auto picks Level 1', () => {
    expect(
      decideFallback({
        policy: 'auto',
        has3dTiles: true,
        hasFeatureIds: false,
        styleAvailable: true,
        pmtilesAvailable: false,
      }),
    ).toBe('level-1-3dtiles-raw');
  });

  it('no 3D tiles + pmtiles available → Level 2 footprint', () => {
    expect(
      decideFallback({
        policy: 'auto',
        has3dTiles: false,
        hasFeatureIds: false,
        styleAvailable: false,
        pmtilesAvailable: true,
      }),
    ).toBe('level-2-pmtiles-extruded');
  });

  it('force-footprint requires pmtiles, else off', () => {
    expect(
      decideFallback({
        policy: 'force-footprint',
        has3dTiles: true,
        hasFeatureIds: true,
        styleAvailable: true,
        pmtilesAvailable: false,
      }),
    ).toBe('off');
  });
});

describe('hazard semantics: covered=false → no overlay', () => {
  it('compositor keeps base color when covered=false', () => {
    const table = createStyleTable(tableWithCovered(false), 't');
    const colorBy: CompiledColorBy = compileColorBy('height', '#777777');
    // Mock a "river_flood" hazard layer
    const layer = {
      id: 'l',
      type: 'river_flood' as const,
      spec: {
        type: 'river_flood' as const,
        covered: 'river_flood_covered',
        coverage_source_ids: 'river_flood_coverage_source_ids',
        hit_source_ids: 'river_flood_hit_source_ids',
        coverage_confidence: 'river_flood_coverage_confidence',
        depth_max: 'river_flood_depth_max',
      },
      ramp: { evaluate: () => [0, 0, 255, 255] as const },
      missing: [0, 0, 0, 0] as const,
      safe: [0, 255, 0, 255] as const,
      opacity: 0.6,
      evaluate: (row: number, t: typeof table) => {
        const covered = t.getBoolean(row, 'river_flood_covered');
        if (covered !== true) return [0, 0, 0, 0] as const;
        return [0, 0, 255, 153] as const;
      },
    };
    const baseColor = colorBy.evaluate(0, table);
    const tex = buildTileColorTexture({
      table,
      colorBy,
      layers: [layer as unknown as Parameters<typeof buildTileColorTexture>[0]['layers'][0]],
    });
    const data = tex.texture.image.data as Uint8Array;
    expect([data[0], data[1], data[2], data[3]]).toEqual([
      baseColor[0],
      baseColor[1],
      baseColor[2],
      255,
    ]);
  });
});
