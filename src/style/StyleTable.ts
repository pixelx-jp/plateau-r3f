import type { Table, Vector } from 'apache-arrow';
import type { BuildingAttributes } from '../types/public';

export interface StyleTable {
  readonly tile_content_uri: string;
  readonly featureCount: number;
  /**
   * One past the largest feature_id observed. Use this to size lookup
   * structures keyed by feature_id (e.g. per-tile color textures), since
   * feature_ids are not always contiguous from 0.
   */
  readonly featureIdMax: number;
  has(field: string): boolean;
  rowOf(featureId: number): number;
  /** Reverse of rowOf — return the feature_id stored at this row, or -1. */
  featureIdAt(row: number): number;
  getNumber(row: number, field: string): number | null;
  getBoolean(row: number, field: string): boolean | null;
  getString(row: number, field: string): string | null;
  fieldNames(): string[];
  materialize(featureId: number, fields?: string[]): BuildingAttributes;
}

interface ColumnEntry {
  vector: Vector;
  kind: 'number' | 'boolean' | 'string' | 'other';
}

function classifyColumn(v: Vector): ColumnEntry['kind'] {
  const t = v.type;
  const id = (t as { typeId?: number }).typeId;
  // Arrow typeIds: 0=Null,1=Int,2=Float,3=Binary,4=Utf8,6=Bool ...
  if (id === 1 || id === 2 || id === 7 /*Decimal*/ || id === 8 /*Date*/) return 'number';
  if (id === 6) return 'boolean';
  if (id === 4 || id === 5 /*LargeUtf8*/) return 'string';
  if ((t as { toString: () => string }).toString) {
    const s = (t as { toString: () => string }).toString();
    if (/int|float|decimal/i.test(s)) return 'number';
    if (/bool/i.test(s)) return 'boolean';
    if (/utf8|string/i.test(s)) return 'string';
  }
  return 'other';
}

function pickFeatureIdField(table: Table): string {
  const candidates = [
    'tile_feature_id',
    'feature_id',
    '_feature_id',
    'featureId',
    '_FEATURE_ID_0',
    '_BATCHID',
  ];
  for (const c of candidates) {
    if (table.schema.fields.some((f) => f.name === c)) return c;
  }
  return '';
}

export function createStyleTable(
  table: Table,
  tile_content_uri: string,
): StyleTable {
  const columns = new Map<string, ColumnEntry>();
  for (const f of table.schema.fields) {
    const vec = table.getChild(f.name);
    if (!vec) continue;
    columns.set(f.name, { vector: vec, kind: classifyColumn(vec) });
  }

  const featureCount = table.numRows;
  const fidField = pickFeatureIdField(table);

  const rowByFeatureId = new Map<number, number>();
  const featureIdByRow = new Int32Array(featureCount).fill(-1);
  let featureIdMax = 0;
  if (fidField) {
    const col = columns.get(fidField)!.vector;
    for (let i = 0; i < featureCount; i++) {
      const v = col.get(i);
      let n: number | null = null;
      if (typeof v === 'number') n = v;
      else if (typeof v === 'bigint') n = Number(v);
      if (n !== null) {
        rowByFeatureId.set(n, i);
        featureIdByRow[i] = n;
        if (n + 1 > featureIdMax) featureIdMax = n + 1;
      }
    }
  } else {
    for (let i = 0; i < featureCount; i++) {
      rowByFeatureId.set(i, i);
      featureIdByRow[i] = i;
    }
    featureIdMax = featureCount;
  }

  const has = (field: string) => columns.has(field);

  const rowOf = (featureId: number) => {
    const r = rowByFeatureId.get(featureId);
    return r === undefined ? -1 : r;
  };

  const featureIdAt = (row: number) =>
    row < 0 || row >= featureCount ? -1 : featureIdByRow[row];

  const getNumber = (row: number, field: string): number | null => {
    if (row < 0) return null;
    const entry = columns.get(field);
    if (!entry || entry.kind !== 'number') return null;
    const v = entry.vector.get(row);
    if (v == null) return null;
    return typeof v === 'bigint' ? Number(v) : (v as number);
  };

  const getBoolean = (row: number, field: string): boolean | null => {
    if (row < 0) return null;
    const entry = columns.get(field);
    if (!entry) return null;
    const v = entry.vector.get(row);
    if (v == null) return null;
    if (entry.kind === 'boolean') return Boolean(v);
    if (entry.kind === 'number') return Number(v) !== 0;
    return null;
  };

  const getString = (row: number, field: string): string | null => {
    if (row < 0) return null;
    const entry = columns.get(field);
    if (!entry) return null;
    const v = entry.vector.get(row);
    if (v == null) return null;
    if (entry.kind === 'string') return String(v);
    return String(v);
  };

  const fieldNames = () => Array.from(columns.keys());

  const materialize = (
    featureId: number,
    fields?: string[],
  ): BuildingAttributes => {
    const row = rowOf(featureId);
    const out: BuildingAttributes = {
      tile_content_uri,
      feature_id: featureId,
      source: '3dtiles',
      _attribution: [],
    };
    const names = fields ?? fieldNames();
    for (const name of names) {
      const entry = columns.get(name);
      if (!entry) continue;
      if (row < 0) {
        out[name] = null;
        continue;
      }
      switch (entry.kind) {
        case 'number':
          out[name] = getNumber(row, name);
          break;
        case 'boolean':
          out[name] = getBoolean(row, name);
          break;
        case 'string':
          out[name] = getString(row, name);
          break;
        default: {
          const v = entry.vector.get(row);
          out[name] = v == null ? null : v;
        }
      }
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
