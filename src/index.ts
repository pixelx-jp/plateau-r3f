// Components
export { Plateau } from './components/Plateau';
export { HazardLayer } from './components/HazardLayer';
export {
  FloodLayer,
  InlandFloodLayer,
  TsunamiLayer,
  StormSurgeLayer,
  LandslideLayer,
} from './components/HazardLayerAliases';
export { FootprintLayer } from './components/FootprintLayer';
export { TileDebugLayer } from './components/TileDebugLayer';

// Hooks
export { useBuilding } from './hooks/useBuilding';
export { useBuildings } from './hooks/useBuildings';
export { usePlateauContext, usePlateauContextOptional } from './hooks/usePlateauContext';

// Core runtime (advanced users)
export { createPlateauRuntime } from './core/PlateauRuntime';
export type { PlateauRuntime } from './core/PlateauRuntime';
export { defaultResolver, loadArtifacts } from './core/ManifestLoader';
export type { ArtifactResolver, ResolvedArtifacts } from './core/ManifestLoader';

// Style / color
export { compileColorBy } from './style/colorBy';
export { compileRamp, parseColor } from './style/ColorRamp';
export { createWorkerStyleDecoder } from './style/createWorkerStyleDecoder';
export { buildTileColorTexture } from './style/TileColorizer';
export { createStyleTable } from './style/StyleTable';
export { createStyleTableCache } from './style/StyleTableCache';

// Hazards
export {
  HAZARD_FIELD_SPECS,
  ALL_HAZARD_TYPES,
} from './hazards/hazardFields';
export type { HazardFieldSpec } from './hazards/hazardFields';
export { compileHazardLayer } from './hazards/hazardColor';
export {
  getHazardLayer,
  listHazardLayers,
  registerHazardLayer,
} from './hazards/HazardLayerRegistry';
export type {
  RegisteredHazardLayer,
  RegisterHazardLayerOptions,
} from './hazards/HazardLayerRegistry';

// Shader extension API
export type { ShaderExtension, ShaderLike } from './shader/ShaderInjector';
export { PLATEAU_FEATURE_ID_ATTRIBUTE } from './shader/featureId';

// Tile lifecycle (advanced inspection)
export type { TileLifecycleState } from './core/TileLifecycle';
export { canTransition } from './core/TileLifecycle';
export type { TileRuntimeHandle, TileColorTexture, FeatureIdAttribute } from './types/internal';

// Style table (advanced)
export type { StyleTable } from './style/StyleTable';

// Store selectors (advanced — use with zustand subscribe / useStore)
export * as selectors from './store/selectors';
export type { PlateauStoreState } from './store/types';

// Fallback
export { decideFallback } from './fallback/FallbackController';
export type { FallbackMode } from './fallback/FallbackController';
export { FallbackExtrusionLayer } from './fallback/FallbackExtrusionLayer';

// Types (public surface)
export type {
  Attribution,
  BuildingAttributes,
  BuildingFilter,
  BuildingKey,
  BuildingSource,
  BuiltinColorBy,
  ColorBy,
  ColorPlan,
  ColorRamp,
  ColorRampColorBy,
  FallbackPolicy,
  FootprintLayerProps,
  HazardCoverageConfidence,
  HazardLayerProps,
  HazardLayerState,
  HazardType,
  Manifest,
  PlateauError,
  PlateauProps,
  PlateauRuntimeApi,
  Rgba8,
  TileIndex,
} from './types/public';
