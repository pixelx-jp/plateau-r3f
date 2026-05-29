import * as THREE from 'three';
import type {
  ColorBy,
  ColorRampColorBy,
  HazardType,
  Rgba8,
} from '../types/public';
import { compileRamp, parseColor, type CompiledRamp } from './ColorRamp';
import type { StyleTable } from './StyleTable';
import { ALL_HAZARD_TYPES, HAZARD_FIELD_SPECS } from '../hazards/hazardFields';
import { getHazardLayer } from '../hazards/HazardLayerRegistry';

export interface CompiledColorBy {
  id: string;
  requiredFields: string[];
  evaluate(row: number, table: StyleTable): Rgba8;
}

const YEAR_RAMP = compileRamp({
  type: 'linear',
  stops: [
    { value: 1900, color: '#5e3c99' },
    { value: 1950, color: '#b2abd2' },
    { value: 1981, color: '#f6e8c3' },
    { value: 2000, color: '#fdb863' },
    { value: 2020, color: '#e66101' },
  ],
  missing: '#bbbbbb',
});

const HEIGHT_RAMP = compileRamp({
  type: 'linear',
  stops: [
    { value: 0, color: '#edf8fb' },
    { value: 10, color: '#b3cde3' },
    { value: 30, color: '#8c96c6' },
    { value: 60, color: '#8856a7' },
    { value: 120, color: '#810f7c' },
  ],
  missing: '#bbbbbb',
});

const STRUCTURE_RAMP = compileRamp({
  type: 'categorical',
  categories: {
    RC: '#3182bd',
    SRC: '#6baed6',
    S: '#9ecae1',
    W: '#fd8d3c',
    CB: '#e6550d',
    Other: '#bbbbbb',
  },
  missing: '#bbbbbb',
});

function rampFromHazard(type: HazardType): CompiledRamp {
  return compileRamp({
    type: 'linear',
    stops: [
      { value: 0, color: '#ffffcc' },
      { value: 1, color: '#a1dab4' },
      { value: 3, color: '#41b6c4' },
      { value: 5, color: '#2c7fb8' },
      { value: 10, color: '#253494' },
    ],
    missing: '#bbbbbb',
  });
}

function withOpaqueFallback(
  fn: (row: number, table: StyleTable) => Rgba8,
  fallback: Rgba8,
): (row: number, table: StyleTable) => Rgba8 {
  return (row, table) => {
    const c = fn(row, table);
    // Base colorBy must replace original material; "missing" still gets a
    // visible (opaque) fallback color rather than alpha=0.
    if (c[3] === 0) return fallback;
    if (c[3] < 255) return [c[0], c[1], c[2], 255];
    return c;
  };
}

export function compileColorBy(
  colorBy: ColorBy | undefined,
  fallbackColor: THREE.ColorRepresentation,
): CompiledColorBy {
  const fallback: Rgba8 = parseColor(fallbackColor);

  if (colorBy === undefined) {
    return {
      id: 'default',
      requiredFields: [],
      evaluate: () => fallback,
    };
  }

  if (typeof colorBy === 'function') {
    return {
      id: 'fn',
      requiredFields: [],
      evaluate: withOpaqueFallback((row, table) => {
        if (row < 0) return fallback;
        const fid = table.featureIdAt(row);
        if (fid < 0) return fallback;
        const attrs = table.materialize(fid);
        const c = (colorBy as (a: typeof attrs) => THREE.ColorRepresentation)(attrs);
        return parseColor(c);
      }, fallback),
    };
  }

  if (typeof colorBy === 'object') {
    const { field, ramp } = colorBy as ColorRampColorBy;
    const r = compileRamp(ramp);
    return {
      id: `ramp:${field}`,
      requiredFields: [field],
      evaluate: withOpaqueFallback((row, table) => {
        if (!table.has(field)) return fallback;
        const v =
          table.getNumber(row, field) ??
          table.getString(row, field);
        return r.evaluate(v);
      }, fallback),
    };
  }

  // BuiltinColorBy
  if (colorBy === 'year_built') {
    return {
      id: 'year_built',
      requiredFields: ['year_built'],
      evaluate: withOpaqueFallback(
        (row, table) => YEAR_RAMP.evaluate(table.getNumber(row, 'year_built')),
        fallback,
      ),
    };
  }
  if (colorBy === 'height') {
    return {
      id: 'height',
      requiredFields: ['height'],
      evaluate: withOpaqueFallback(
        (row, table) => HEIGHT_RAMP.evaluate(table.getNumber(row, 'height')),
        fallback,
      ),
    };
  }
  if (colorBy === 'structure') {
    return {
      id: 'structure',
      requiredFields: ['structure'],
      evaluate: withOpaqueFallback(
        (row, table) => STRUCTURE_RAMP.evaluate(table.getString(row, 'structure')),
        fallback,
      ),
    };
  }

  // hazard as builtin colorBy (built-in OR custom registered)
  if (typeof colorBy === 'string') {
    const registered = getHazardLayer(colorBy);
    if (registered) {
      const spec = registered.spec;
      const ramp = rampFromHazard(colorBy as HazardType);
      return {
        id: `hazard:${colorBy}`,
        requiredFields: [spec.covered, spec.depth_max ?? '', spec.in_zone ?? ''].filter(Boolean),
        evaluate: withOpaqueFallback((row, table) => {
          const covered = table.getBoolean(row, spec.covered);
          if (covered !== true) return fallback;
          if (spec.in_zone) {
            const inZone = table.getBoolean(row, spec.in_zone);
            return inZone ? parseColor('#d73027') : parseColor('#9ad48a');
          }
          if (spec.depth_max) {
            const depth = table.getNumber(row, spec.depth_max);
            if (depth === null || depth <= 0) return parseColor('#9ad48a');
            return ramp.evaluate(depth);
          }
          return fallback;
        }, fallback),
      };
    }
  }

  return { id: 'default', requiredFields: [], evaluate: () => fallback };
}
