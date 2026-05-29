import * as THREE from 'three';
import type { HazardLayerState, HazardType, Rgba8 } from '../types/public';
import { HAZARD_FIELD_SPECS, type HazardFieldSpec } from './hazardFields';
import { compileRamp, parseColor, type CompiledRamp } from '../style/ColorRamp';
import type { StyleTable } from '../style/StyleTable';
import { getHazardLayer } from './HazardLayerRegistry';

const DEFAULT_DEPTH_RAMP_STOPS = [
  { value: 0.0, color: '#ffffcc' },
  { value: 0.5, color: '#a1dab4' },
  { value: 1.0, color: '#41b6c4' },
  { value: 3.0, color: '#2c7fb8' },
  { value: 5.0, color: '#253494' },
  { value: 10.0, color: '#081d58' },
];

const DEFAULT_MISSING = '#888888';
const DEFAULT_SAFE = '#9ad48a';
const DEFAULT_LANDSLIDE_IN_ZONE = '#d73027';

export interface CompiledHazardLayer {
  id: string;
  type: HazardType | string;
  spec: HazardFieldSpec;
  ramp: CompiledRamp;
  missing: Rgba8;
  safe: Rgba8;
  opacity: number;
  evaluate(row: number, table: StyleTable): Rgba8;
}

function defaultRampFor(type: HazardType) {
  if (type === 'landslide') {
    return {
      type: 'categorical' as const,
      categories: { true: DEFAULT_LANDSLIDE_IN_ZONE, false: DEFAULT_SAFE },
      missing: DEFAULT_MISSING,
    };
  }
  return {
    type: 'linear' as const,
    stops: DEFAULT_DEPTH_RAMP_STOPS,
    missing: DEFAULT_MISSING,
  };
}

export function compileHazardLayer(layer: HazardLayerState): CompiledHazardLayer {
  // Look up via the registry so custom hazards registered with
  // `registerHazardLayer` work end-to-end. Built-ins are pre-seeded.
  const registered = getHazardLayer(layer.type);
  const spec: HazardFieldSpec =
    registered?.spec ?? HAZARD_FIELD_SPECS[layer.type as HazardType];
  if (!spec) {
    throw new Error(
      `[plateau-r3f] unknown hazard type "${layer.type}". Call registerHazardLayer() first.`,
    );
  }
  const ramp = compileRamp(
    layer.colorRamp ?? registered?.defaultRamp ?? defaultRampFor(layer.type as HazardType),
  );
  const missing = parseColor(layer.missingColor ?? DEFAULT_MISSING, 0);
  const safe = parseColor(layer.safeColor ?? DEFAULT_SAFE, Math.round(layer.opacity * 255));

  const opacity = Math.max(0, Math.min(1, layer.opacity));

  const evaluate = (row: number, table: StyleTable): Rgba8 => {
    if (row < 0) return [0, 0, 0, 0];

    const covered = table.getBoolean(row, spec.covered);
    if (covered !== true) {
      // covered=false or null → no data, do not overlay
      return [0, 0, 0, 0];
    }

    // Zone-style hazards (boolean per building).
    if (spec.in_zone) {
      const inZone = table.getBoolean(row, spec.in_zone);
      const col = ramp.evaluate(inZone === null ? null : String(inZone));
      return [col[0], col[1], col[2], Math.round(opacity * 255)];
    }

    // Depth-style hazards (numeric).
    if (spec.depth_max) {
      const depth = table.getNumber(row, spec.depth_max);
      if (depth === null || !Number.isFinite(depth) || depth <= 0) {
        return [safe[0], safe[1], safe[2], Math.round(opacity * 255 * 0.5)];
      }
      const col = ramp.evaluate(depth);
      return [col[0], col[1], col[2], Math.round(opacity * 255)];
    }

    return [0, 0, 0, 0];
  };

  return {
    id: layer.id,
    type: layer.type,
    spec,
    ramp,
    missing,
    safe,
    opacity,
    evaluate,
  };
}

export type { THREE };
