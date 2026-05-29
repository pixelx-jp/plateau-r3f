# API reference

Top-level exports of `@plateau/r3f`:

| group | exports |
| --- | --- |
| Components | `<Plateau>`, `<HazardLayer>`, `<FootprintLayer>`, `<FallbackExtrusionLayer>`, `<TileDebugLayer>`, `<FloodLayer>` `<InlandFloodLayer>` `<TsunamiLayer>` `<StormSurgeLayer>` `<LandslideLayer>` |
| Hooks | `useBuilding`, `useBuildings`, `usePlateauContext`, `usePlateauContextOptional` |
| Runtime | `createPlateauRuntime`, `defaultResolver`, `loadArtifacts` |
| Style | `compileColorBy`, `compileRamp`, `parseColor`, `buildTileColorTexture`, `createStyleTable`, `createStyleTableCache`, `createWorkerStyleDecoder` |
| Hazards | `registerHazardLayer`, `getHazardLayer`, `listHazardLayers`, `compileHazardLayer`, `HAZARD_FIELD_SPECS`, `ALL_HAZARD_TYPES` |
| Fallback | `decideFallback`, `FallbackExtrusionLayer` |
| Lifecycle | `canTransition` |
| Shader | `PLATEAU_FEATURE_ID_ATTRIBUTE`, types `ShaderExtension`, `ShaderLike` |
| Store | `selectors.*` (`selectStatus`, `selectIsReady`, `selectVisibleTileUris`, `selectEnabledLayerIds`, `selectWarnings`, ...) |
| Types | `PlateauProps`, `HazardLayerProps`, `FootprintLayerProps`, `BuildingAttributes`, `BuildingKey`, `BuildingFilter`, `BuildingSource`, `ColorBy`, `ColorRamp`, `ColorRampColorBy`, `BuiltinColorBy`, `HazardType`, `HazardCoverageConfidence`, `FallbackPolicy`, `FallbackMode`, `TileLifecycleState`, `TileRuntimeHandle`, `TileColorTexture`, `Manifest`, `TileIndex`, `Attribution`, `PlateauStoreState`, `Rgba8` |

Drill down via the sidebar.
