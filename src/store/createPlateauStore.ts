import { createStore, type StoreApi } from 'zustand/vanilla';
import type { PlateauStoreState } from './types';
import type { BuildingKey } from '../types/public';
import type { PlateauWarning } from '../types/internal';

export interface PlateauStore extends StoreApi<PlateauStoreState> {
  setStatus(status: PlateauStoreState['status']): void;
  setVisibleTileUris(uris: string[]): void;
  setSelectedBuilding(key?: BuildingKey): void;
  bumpColorPlanVersion(): void;
  setEnabledLayerIds(ids: string[]): void;
  pushWarning(w: PlateauWarning): void;
}

export function createPlateauStore(): PlateauStore {
  const store = createStore<PlateauStoreState>(() => ({
    status: 'idle',
    visibleTileUris: [],
    selectedBuilding: undefined,
    colorPlanVersion: 0,
    enabledLayerIds: [],
    warnings: [],
  }));

  const ext = store as PlateauStore;
  ext.setStatus = (status) => store.setState({ status });
  ext.setVisibleTileUris = (uris) => store.setState({ visibleTileUris: uris });
  ext.setSelectedBuilding = (key) => store.setState({ selectedBuilding: key });
  ext.bumpColorPlanVersion = () =>
    store.setState((s) => ({ colorPlanVersion: s.colorPlanVersion + 1 }));
  ext.setEnabledLayerIds = (ids) => store.setState({ enabledLayerIds: ids });
  ext.pushWarning = (w) =>
    store.setState((s) => ({ warnings: [...s.warnings, w] }));
  return ext;
}
