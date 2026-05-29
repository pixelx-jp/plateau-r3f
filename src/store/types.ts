import type { BuildingKey } from '../types/public';
import type { PlateauWarning } from '../types/internal';

export interface PlateauStoreState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  visibleTileUris: string[];
  selectedBuilding?: BuildingKey;
  colorPlanVersion: number;
  enabledLayerIds: string[];
  warnings: PlateauWarning[];
}
