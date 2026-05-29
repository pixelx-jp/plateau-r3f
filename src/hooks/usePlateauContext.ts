import { createContext, useContext } from 'react';
import type { PlateauRuntime } from '../core/PlateauRuntime';
import type { ResolvedArtifacts } from '../core/ManifestLoader';
import type { PlateauStore } from '../store/createPlateauStore';
import type { HazardLayerState } from '../types/public';

export interface PlateauContextValue {
  runtime: PlateauRuntime;
  store: PlateauStore;
  artifacts: ResolvedArtifacts;
  /**
   * Register a hazard layer. Calling again with the same `layer.id` updates
   * its props in place without changing visual priority (children mount order
   * still wins). The returned function unregisters and removes the slot.
   */
  registerHazardLayer(layer: HazardLayerState): () => void;
  /** Update an already-registered hazard layer in place — order preserved. */
  updateHazardLayer(layer: HazardLayerState): void;
}

export const PlateauContext = createContext<PlateauContextValue | null>(null);

export function usePlateauContext(): PlateauContextValue {
  const ctx = useContext(PlateauContext);
  if (!ctx) {
    throw new Error('usePlateauContext must be used inside <Plateau>');
  }
  return ctx;
}

export function usePlateauContextOptional(): PlateauContextValue | null {
  return useContext(PlateauContext);
}
