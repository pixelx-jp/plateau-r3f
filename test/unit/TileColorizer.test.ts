import { describe, it, expect } from 'vitest';
import { tableFromArrays } from 'apache-arrow';
import { createStyleTable } from '../../src/style/StyleTable';
import { buildTileColorTexture } from '../../src/style/TileColorizer';
import { compileColorBy } from '../../src/style/colorBy';

function makeSparseTable() {
  // Three buildings with non-contiguous tile_feature_id: 0, 5, 380.
  return tableFromArrays({
    tile_feature_id: new Int32Array([0, 5, 380]),
    height: new Float64Array([10, 30, 120]),
    river_flood_covered: [true, true, false],
    river_flood_depth_max: new Float64Array([0, 2.5, 0]),
  });
}

describe('TileColorizer with sparse feature_id', () => {
  it('builds texture sized for max feature_id, not row count', () => {
    const t = createStyleTable(makeSparseTable(), 'sparse/tile');
    expect(t.featureCount).toBe(3);
    expect(t.featureIdMax).toBe(381);
    const colorBy = compileColorBy('height', '#bbbbbb');
    const tex = buildTileColorTexture({ table: t, colorBy, layers: [] });
    // Texture must have at least 381 cells.
    expect(tex.featureCount).toBeGreaterThanOrEqual(381);
    expect(tex.width * tex.height).toBeGreaterThanOrEqual(381);
  });

  it('writes colors at the correct feature_id slots, fills gaps with fallback', () => {
    const t = createStyleTable(makeSparseTable(), 'sparse/tile');
    const colorBy = compileColorBy('height', '#ff0000');
    const tex = buildTileColorTexture({ table: t, colorBy, layers: [] });
    const data = tex.texture.image.data as Uint8Array;
    const stride = 4;
    const at = (fid: number) => [
      data[fid * stride],
      data[fid * stride + 1],
      data[fid * stride + 2],
      data[fid * stride + 3],
    ];
    // fid 0 has height=10 → ramp color, fid 1 has no row → fallback
    expect(at(0)[3]).toBe(255);
    expect(at(1)).toEqual([255, 0, 0, 255]); // fallback (red) at gap
    expect(at(5)[3]).toBe(255);
    expect(at(380)[3]).toBe(255);
  });

  it('feature_id with no matching row returns null from rowOf', () => {
    const t = createStyleTable(makeSparseTable(), 'sparse/tile');
    expect(t.rowOf(0)).toBe(0);
    expect(t.rowOf(5)).toBe(1);
    expect(t.rowOf(380)).toBe(2);
    expect(t.rowOf(1)).toBe(-1);
    expect(t.rowOf(381)).toBe(-1);
  });
});
