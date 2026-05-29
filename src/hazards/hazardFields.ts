import type { HazardType } from '../types/public';

export interface HazardFieldSpec {
  type: HazardType;
  covered: string;
  coverage_source_ids: string;
  hit_source_ids: string;
  coverage_confidence: string;
  depth_max?: string;
  in_zone?: string;
}

export const HAZARD_FIELD_SPECS: Record<HazardType, HazardFieldSpec> = {
  river_flood: {
    type: 'river_flood',
    covered: 'river_flood_covered',
    coverage_source_ids: 'river_flood_coverage_source_ids',
    hit_source_ids: 'river_flood_hit_source_ids',
    coverage_confidence: 'river_flood_coverage_confidence',
    depth_max: 'river_flood_depth_max',
  },
  inland_flood: {
    type: 'inland_flood',
    covered: 'inland_flood_covered',
    coverage_source_ids: 'inland_flood_coverage_source_ids',
    hit_source_ids: 'inland_flood_hit_source_ids',
    coverage_confidence: 'inland_flood_coverage_confidence',
    depth_max: 'inland_flood_depth_max',
  },
  tsunami: {
    type: 'tsunami',
    covered: 'tsunami_covered',
    coverage_source_ids: 'tsunami_coverage_source_ids',
    hit_source_ids: 'tsunami_hit_source_ids',
    coverage_confidence: 'tsunami_coverage_confidence',
    depth_max: 'tsunami_depth_max',
  },
  storm_surge: {
    type: 'storm_surge',
    covered: 'storm_surge_covered',
    coverage_source_ids: 'storm_surge_coverage_source_ids',
    hit_source_ids: 'storm_surge_hit_source_ids',
    coverage_confidence: 'storm_surge_coverage_confidence',
    depth_max: 'storm_surge_depth_max',
  },
  landslide: {
    type: 'landslide',
    covered: 'landslide_covered',
    coverage_source_ids: 'landslide_coverage_source_ids',
    hit_source_ids: 'landslide_hit_source_ids',
    coverage_confidence: 'landslide_coverage_confidence',
    in_zone: 'landslide_in_zone',
  },
};

export const ALL_HAZARD_TYPES: HazardType[] = [
  'river_flood',
  'inland_flood',
  'tsunami',
  'storm_surge',
  'landslide',
];
