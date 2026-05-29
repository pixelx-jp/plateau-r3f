# Types

Selected highlights — refer to `dist/index.d.ts` for the full surface.

## `PlateauProps`

```ts
interface PlateauProps {
  city: string;
  baseUrl?: string;
  colorBy?: ColorBy;
  fallback?: FallbackPolicy;
  opacity?: number;
  missingColor?: THREE.ColorRepresentation;
  resolver?: ArtifactResolver;
  shaderExtensions?: ShaderExtension[];
  styleDecoder?: (uri, url, signal?) => Promise<StyleTable>;
  onReady?: (runtime: PlateauRuntimeApi) => void;
  onError?: (error: PlateauError) => void;
  children?: ReactNode;
}
```

## `BuildingAttributes`

Always present:

```ts
tile_content_uri, feature_id, source ('3dtiles' | 'pmtiles-fallback'), _attribution
```

Optional building fields: `year_built`, `structure`, `height`, `floors`.

Per hazard `<type>` ∈ `{river_flood, inland_flood, tsunami, storm_surge, landslide}`:

```ts
<type>_covered
<type>_coverage_source_ids
<type>_hit_source_ids
<type>_coverage_confidence   // 'explicit_polygon' | 'declared_full_admin' | 'inundation_bounded' | 'unknown'
<type>_depth_max             // for flood/tsunami/surge
<type>_in_zone               // for landslide only
```

`[key: string]: unknown` — custom columns in your arrow files pass through.

## `ColorBy`

```ts
type BuiltinColorBy = 'year_built' | 'structure' | 'height' | HazardType;

type ColorBy =
  | BuiltinColorBy
  | { field: string; ramp: ColorRamp }
  | ((attrs: BuildingAttributes) => THREE.ColorRepresentation);
```

## `ColorRamp`

```ts
interface ColorRamp {
  type: 'linear' | 'categorical';
  domain?: [number, number];
  stops?: Array<{ value: number; color: string }>;
  categories?: Record<string, string>;
  missing?: string;
}
```

## `FallbackPolicy` / `FallbackMode`

```ts
type FallbackPolicy = 'auto' | 'force-3dtiles' | 'force-footprint' | 'off';

type FallbackMode =
  | 'level-0-3dtiles-styled'
  | 'level-1-3dtiles-raw'
  | 'level-2-pmtiles-extruded'
  | 'level-3-pmtiles-flat'
  | 'off';
```

`FallbackPolicy` is the user input; `FallbackMode` is what the runtime resolved to.

## `TileLifecycleState`

```ts
type TileLifecycleState =
  | 'discovered' | 'geometryLoaded'
  | 'featureIdDetected' | 'featureIdMissing'
  | 'styleRequested' | 'styleLoaded' | 'colorTextureReady'
  | 'shaderInjected'
  | 'visible' | 'hidden' | 'disposed';
```
