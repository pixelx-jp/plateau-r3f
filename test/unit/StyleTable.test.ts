import { describe, it, expect } from 'vitest';
import {
  tableFromArrays,
  vectorFromArray,
  Table,
  Float64,
  Bool,
  Utf8,
  makeVector,
} from 'apache-arrow';
import { createStyleTable } from '../../src/style/StyleTable';

function makeTable(): Table {
  return tableFromArrays({
    feature_id: new Int32Array([0, 1, 2]),
    year_built: new Float64Array([1970, 1995, NaN]),
    structure: ['RC', 'W', 'S'],
    river_flood_covered: [true, true, false],
    river_flood_depth_max: new Float64Array([0, 2.5, 0]),
  });
}

describe('StyleTable', () => {
  it('maps feature_id to row', () => {
    const t = createStyleTable(makeTable(), 'test/tile');
    expect(t.featureCount).toBe(3);
    expect(t.rowOf(0)).toBe(0);
    expect(t.rowOf(1)).toBe(1);
    expect(t.rowOf(999)).toBe(-1);
  });

  it('typed getters honor nullability', () => {
    const t = createStyleTable(makeTable(), 'test/tile');
    expect(t.getNumber(1, 'year_built')).toBe(1995);
    expect(t.getString(0, 'structure')).toBe('RC');
    expect(t.getBoolean(0, 'river_flood_covered')).toBe(true);
    expect(t.getBoolean(2, 'river_flood_covered')).toBe(false);
    expect(t.getNumber(0, 'missing_field')).toBeNull();
    expect(t.getNumber(-1, 'year_built')).toBeNull();
  });

  it('materialize returns expected shape', () => {
    const t = createStyleTable(makeTable(), 'test/tile');
    const attrs = t.materialize(1);
    expect(attrs.tile_content_uri).toBe('test/tile');
    expect(attrs.feature_id).toBe(1);
    expect(attrs.year_built).toBe(1995);
    expect(attrs.structure).toBe('W');
    expect(attrs.river_flood_covered).toBe(true);
    expect(attrs.river_flood_depth_max).toBe(2.5);
  });
});
