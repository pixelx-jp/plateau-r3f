import { describe, it, expect } from 'vitest';
import { HAZARD_FIELD_SPECS, ALL_HAZARD_TYPES } from '../../src/hazards/hazardFields';

describe('hazardFields', () => {
  it('declares all 5 prefixes', () => {
    expect(ALL_HAZARD_TYPES).toEqual([
      'river_flood',
      'inland_flood',
      'tsunami',
      'storm_surge',
      'landslide',
    ]);
  });

  it('uses pipeline field names', () => {
    expect(HAZARD_FIELD_SPECS.river_flood.depth_max).toBe('river_flood_depth_max');
    expect(HAZARD_FIELD_SPECS.tsunami.coverage_confidence).toBe('tsunami_coverage_confidence');
    expect(HAZARD_FIELD_SPECS.landslide.in_zone).toBe('landslide_in_zone');
    expect(HAZARD_FIELD_SPECS.landslide.depth_max).toBeUndefined();
  });
});
