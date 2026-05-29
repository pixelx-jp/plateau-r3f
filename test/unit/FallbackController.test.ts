import { describe, it, expect } from 'vitest';
import { decideFallback } from '../../src/fallback/FallbackController';

describe('FallbackController', () => {
  it('auto picks styled when everything available', () => {
    expect(
      decideFallback({
        policy: 'auto',
        has3dTiles: true,
        hasFeatureIds: true,
        styleAvailable: true,
        pmtilesAvailable: true,
      }),
    ).toBe('level-0-3dtiles-styled');
  });

  it('auto prefers pmtiles-extruded over raw 3dtiles when style missing', () => {
    // Plan: fallback must preserve colorBy. Level 2 (pmtiles + style) > Level 1 (raw).
    expect(
      decideFallback({
        policy: 'auto',
        has3dTiles: true,
        hasFeatureIds: true,
        styleAvailable: false,
        pmtilesAvailable: true,
      }),
    ).toBe('level-2-pmtiles-extruded');
  });

  it('auto drops to raw 3dtiles only when pmtiles also unavailable', () => {
    expect(
      decideFallback({
        policy: 'auto',
        has3dTiles: true,
        hasFeatureIds: true,
        styleAvailable: false,
        pmtilesAvailable: false,
      }),
    ).toBe('level-1-3dtiles-raw');
  });

  it('auto drops to pmtiles when no 3d tiles', () => {
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

  it('force-footprint requires pmtiles', () => {
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

  it('off short-circuits', () => {
    expect(
      decideFallback({
        policy: 'off',
        has3dTiles: true,
        hasFeatureIds: true,
        styleAvailable: true,
        pmtilesAvailable: true,
      }),
    ).toBe('off');
  });
});
