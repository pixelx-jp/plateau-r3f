import type { ColorRamp, HazardType } from '../types/public';
import { ALL_HAZARD_TYPES, HAZARD_FIELD_SPECS, type HazardFieldSpec } from './hazardFields';

export interface RegisteredHazardLayer {
  type: HazardType | string;
  spec: HazardFieldSpec;
  defaultRamp?: ColorRamp;
}

export interface RegisterHazardLayerOptions {
  type: HazardType | string;
  valueField: string;
  coveredField: string;
  hitSourceField?: string;
  coverageSourceField?: string;
  confidenceField?: string;
  inZoneField?: string;
  defaultRamp?: ColorRamp;
}

const registry = new Map<string, RegisteredHazardLayer>();
for (const t of ALL_HAZARD_TYPES) {
  registry.set(t, { type: t, spec: HAZARD_FIELD_SPECS[t] });
}

export function getHazardLayer(type: HazardType | string): RegisteredHazardLayer | undefined {
  return registry.get(type);
}

export function listHazardLayers(): RegisteredHazardLayer[] {
  return Array.from(registry.values());
}

/**
 * Register a custom hazard layer with its field bindings. Built-in types
 * cannot be overridden; pick a unique `type` string.
 */
export function registerHazardLayer(opts: RegisterHazardLayerOptions): () => void {
  if ((ALL_HAZARD_TYPES as string[]).includes(opts.type)) {
    throw new Error(
      `[plateau-r3f] hazard type "${opts.type}" is a built-in and cannot be re-registered`,
    );
  }
  const spec: HazardFieldSpec = {
    type: opts.type as HazardType,
    covered: opts.coveredField,
    coverage_source_ids: opts.coverageSourceField ?? `${opts.type}_coverage_source_ids`,
    hit_source_ids: opts.hitSourceField ?? `${opts.type}_hit_source_ids`,
    coverage_confidence: opts.confidenceField ?? `${opts.type}_coverage_confidence`,
    depth_max: opts.inZoneField ? undefined : opts.valueField,
    in_zone: opts.inZoneField,
  };
  const entry: RegisteredHazardLayer = {
    type: opts.type,
    spec,
    defaultRamp: opts.defaultRamp,
  };
  registry.set(opts.type, entry);
  return () => {
    if (!(ALL_HAZARD_TYPES as string[]).includes(opts.type)) {
      registry.delete(opts.type);
    }
  };
}
