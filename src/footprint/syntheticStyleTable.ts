import type { StyleTable } from '../style/StyleTable';
import type { BuildingAttributes } from '../types/public';

/**
 * Build a `StyleTable`-compatible view over an array of plain attribute
 * records. Used by PMTiles fallback so the same `compileColorBy` and
 * `compileHazardLayer` machinery works against MVT-decoded features.
 */
export function createSyntheticStyleTable(
  tile_content_uri: string,
  rows: Array<Record<string, number | string | boolean | null>>,
): StyleTable {
  const featureCount = rows.length;
  const featureIdMax = featureCount;
  const fieldSet = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) fieldSet.add(k);

  const has = (field: string) => fieldSet.has(field);
  const rowOf = (featureId: number) =>
    featureId < 0 || featureId >= featureCount ? -1 : featureId;
  const featureIdAt = (row: number) =>
    row < 0 || row >= featureCount ? -1 : row;

  const getNumber = (row: number, field: string): number | null => {
    if (row < 0) return null;
    const v = rows[row]?.[field];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };
  const getBoolean = (row: number, field: string): boolean | null => {
    if (row < 0) return null;
    const v = rows[row]?.[field];
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
      if (v === 'true') return true;
      if (v === 'false') return false;
    }
    return null;
  };
  const getString = (row: number, field: string): string | null => {
    if (row < 0) return null;
    const v = rows[row]?.[field];
    if (v === null || v === undefined) return null;
    return String(v);
  };
  const fieldNames = () => Array.from(fieldSet);
  const materialize = (
    featureId: number,
    fields?: string[],
  ): BuildingAttributes => {
    const row = rowOf(featureId);
    const out: BuildingAttributes = {
      tile_content_uri,
      feature_id: featureId,
      source: 'pmtiles-fallback',
      _attribution: [],
    };
    if (row < 0) return out;
    const src = rows[row];
    const names = fields ?? Object.keys(src);
    for (const k of names) {
      out[k] = src[k] ?? null;
    }
    return out;
  };

  return {
    tile_content_uri,
    featureCount,
    featureIdMax,
    has,
    rowOf,
    featureIdAt,
    getNumber,
    getBoolean,
    getString,
    fieldNames,
    materialize,
  };
}
