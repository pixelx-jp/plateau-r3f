import type { PlateauStoreState } from './types';

/**
 * Lightweight selectors over `PlateauStoreState`. Use with `zustand`'s
 * `store.subscribe(selector, listener)` or `useStore(store, selector)`
 * to avoid unnecessary re-renders.
 */

export const selectStatus = (s: PlateauStoreState) => s.status;
export const selectIsReady = (s: PlateauStoreState) => s.status === 'ready';
export const selectIsLoading = (s: PlateauStoreState) => s.status === 'loading';
export const selectHasError = (s: PlateauStoreState) => s.status === 'error';
export const selectVisibleTileCount = (s: PlateauStoreState) => s.visibleTileUris.length;
export const selectVisibleTileUris = (s: PlateauStoreState) => s.visibleTileUris;
export const selectSelectedBuilding = (s: PlateauStoreState) => s.selectedBuilding;
export const selectColorPlanVersion = (s: PlateauStoreState) => s.colorPlanVersion;
export const selectEnabledLayerIds = (s: PlateauStoreState) => s.enabledLayerIds;
export const selectActiveLayerCount = (s: PlateauStoreState) => s.enabledLayerIds.length;
export const selectWarnings = (s: PlateauStoreState) => s.warnings;
export const selectWarningCount = (s: PlateauStoreState) => s.warnings.length;
export const selectLatestWarning = (s: PlateauStoreState) =>
  s.warnings.length === 0 ? undefined : s.warnings[s.warnings.length - 1];
