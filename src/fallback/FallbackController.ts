import type { FallbackPolicy } from '../types/public';

export type FallbackMode =
  | 'level-0-3dtiles-styled'
  | 'level-1-3dtiles-raw'
  | 'level-2-pmtiles-extruded'
  | 'level-3-pmtiles-flat'
  | 'off';

export interface FallbackDecisionInput {
  policy: FallbackPolicy;
  has3dTiles: boolean;
  hasFeatureIds: boolean;
  styleAvailable: boolean;
  pmtilesAvailable: boolean;
  /**
   * Optimistic flag: true once at least one 3D Tile has been inspected for
   * feature-id support. Before that, we assume Level 0 may still work and
   * don't preemptively swap to the PMTiles path. Defaults to true for
   * backwards compatibility.
   */
  tilesInspected?: boolean;
}

export function decideFallback(input: FallbackDecisionInput): FallbackMode {
  if (input.policy === 'off') return 'off';
  if (input.policy === 'force-footprint') {
    return input.pmtilesAvailable ? 'level-2-pmtiles-extruded' : 'off';
  }
  if (input.policy === 'force-3dtiles') {
    if (!input.has3dTiles) return 'off';
    if (input.hasFeatureIds && input.styleAvailable) return 'level-0-3dtiles-styled';
    return 'level-1-3dtiles-raw';
  }
  // auto: prefer the highest-quality colorable level. PMTiles-extruded keeps
  // colorBy working; raw 3D Tiles loses styling entirely. So we prefer Level 2
  // over Level 1 unless pmtiles is unavailable.
  const tilesInspected = input.tilesInspected ?? true;
  if (input.has3dTiles && input.hasFeatureIds && input.styleAvailable) {
    return 'level-0-3dtiles-styled';
  }
  // Don't preemptively drop to PMTiles while we're still loading the first
  // batch of 3D Tiles — wait until we've actually observed missing feature ids.
  if (input.has3dTiles && !tilesInspected) return 'level-0-3dtiles-styled';
  if (input.pmtilesAvailable) return 'level-2-pmtiles-extruded';
  if (input.has3dTiles) return 'level-1-3dtiles-raw';
  return 'off';
}
