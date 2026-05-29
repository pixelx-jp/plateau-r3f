import type * as THREE from 'three';
import type { ReactNode } from 'react';

export type HazardType =
  | 'river_flood'
  | 'inland_flood'
  | 'tsunami'
  | 'storm_surge'
  | 'landslide';

export type HazardCoverageConfidence =
  | 'explicit_polygon'
  | 'declared_full_admin'
  | 'unknown'
  | 'inundation_bounded';

export type BuildingSource = '3dtiles' | 'pmtiles-fallback';

export interface BuildingKey {
  tile_content_uri: string;
  feature_id: number;
}

export interface Attribution {
  dataset_id: string;
  source_url?: string;
  license: string;
  generated_at?: string;
}

export interface BuildingAttributes {
  tile_content_uri: string;
  feature_id: number;
  source: BuildingSource;

  year_built?: number | null;
  structure?: string | null;
  height?: number | null;
  floors?: number | null;

  river_flood_covered?: boolean | null;
  river_flood_coverage_source_ids?: string | null;
  river_flood_depth_max?: number | null;
  river_flood_hit_source_ids?: string | null;
  river_flood_coverage_confidence?: HazardCoverageConfidence | null;

  inland_flood_covered?: boolean | null;
  inland_flood_coverage_source_ids?: string | null;
  inland_flood_depth_max?: number | null;
  inland_flood_hit_source_ids?: string | null;
  inland_flood_coverage_confidence?: HazardCoverageConfidence | null;

  tsunami_covered?: boolean | null;
  tsunami_coverage_source_ids?: string | null;
  tsunami_depth_max?: number | null;
  tsunami_hit_source_ids?: string | null;
  tsunami_coverage_confidence?: HazardCoverageConfidence | null;

  storm_surge_covered?: boolean | null;
  storm_surge_coverage_source_ids?: string | null;
  storm_surge_depth_max?: number | null;
  storm_surge_hit_source_ids?: string | null;
  storm_surge_coverage_confidence?: HazardCoverageConfidence | null;

  landslide_covered?: boolean | null;
  landslide_coverage_source_ids?: string | null;
  landslide_in_zone?: boolean | null;
  landslide_hit_source_ids?: string | null;
  landslide_coverage_confidence?: HazardCoverageConfidence | null;

  _attribution: Attribution[];
  [key: string]: unknown;
}

export interface BuildingFilter {
  predicate?: (attrs: BuildingAttributes) => boolean;
  limit?: number;
}

export type BuiltinColorBy =
  | 'year_built'
  | 'structure'
  | 'height'
  | HazardType;

export type Rgba8 = readonly [number, number, number, number];

export interface ColorRamp {
  type: 'linear' | 'categorical';
  domain?: [number, number];
  stops?: Array<{ value: number; color: string }>;
  categories?: Record<string, string>;
  missing?: string;
}

export interface ColorRampColorBy {
  field: string;
  ramp: ColorRamp;
}

export type ColorBy =
  | BuiltinColorBy
  | ColorRampColorBy
  | ((attrs: BuildingAttributes) => THREE.ColorRepresentation);

export type FallbackPolicy =
  | 'auto'
  | 'force-3dtiles'
  | 'force-footprint'
  | 'off';

export interface PlateauError {
  code:
    | 'manifest_not_found'
    | 'tileset_load_failed'
    | 'style_load_failed'
    | 'feature_id_missing'
    | 'unknown';
  message: string;
  cause?: unknown;
}

export interface PlateauProps {
  city: string;
  baseUrl?: string;
  colorBy?: ColorBy;
  fallback?: FallbackPolicy;
  opacity?: number;
  missingColor?: THREE.ColorRepresentation;
  /** Override how city → artifact URLs are resolved. */
  resolver?: import('../core/ManifestLoader').ArtifactResolver;
  /** Plug additional shader hooks into the per-tile material patch. */
  shaderExtensions?: import('../shader/ShaderInjector').ShaderExtension[];
  /** Plug a custom (e.g. Worker-backed) Arrow decoder. */
  styleDecoder?: (
    tile_content_uri: string,
    url: string,
    signal?: AbortSignal,
  ) => Promise<import('../style/StyleTable').StyleTable>;
  onReady?: (runtime: PlateauRuntimeApi) => void;
  onError?: (error: PlateauError) => void;
  children?: ReactNode;
}

export interface HazardLayerProps {
  /** Built-in HazardType or a string registered via registerHazardLayer. */
  type: HazardType | string;
  visible?: boolean;
  opacity?: number;
  colorRamp?: ColorRamp;
  missingColor?: THREE.ColorRepresentation;
  safeColor?: THREE.ColorRepresentation;
}

export interface FootprintLayerProps {
  visible?: boolean;
  opacity?: number;
  colorBy?: ColorBy;
  /** Mercator tile zoom level to load (defaults to 15). */
  zoom?: number;
  /** Override pmtiles URL. When omitted, taken from the parent `<Plateau>` artifacts. */
  pmtilesUrl?: string;
  /** Render as a flat plate instead of extruded volume (Level 3 fallback). */
  flat?: boolean;
}

export interface HazardLayerState {
  id: string;
  type: HazardType | string;
  visible: boolean;
  opacity: number;
  colorRamp?: ColorRamp;
  missingColor?: THREE.ColorRepresentation;
  safeColor?: THREE.ColorRepresentation;
}

export interface ColorPlan {
  colorBy: ColorBy | undefined;
  opacity: number;
  missingColor: THREE.ColorRepresentation;
  version: number;
}

export interface PlateauRuntimeApi {
  setColorPlan(plan: ColorPlan): void;
  setHazardLayers(layers: HazardLayerState[]): void;
  getBuilding(key: BuildingKey): BuildingAttributes | undefined;
  queryVisibleBuildings(filter?: BuildingFilter): BuildingAttributes[];
  getAttribution(): Attribution[];
  dispose(): void;
}

export interface Manifest {
  attribution?: string;
  tool?: string;
  tool_version?: string;
  generated_at?: string;
  city_code?: string;
  city_name?: string;
  dataset_year?: number;
  n_buildings?: number;
  datasets?: string[];
  sources?: Record<
    string,
    { source_id: string; dataset_id: string; year?: number; url?: string }
  >;
  coverage_stats?: Array<{
    kind: string;
    covered_count: number;
    hit_count: number;
    coverage_confidence_breakdown?: Record<string, number>;
  }>;
  artifacts?: {
    tileset?: string;
    tile_index?: string;
    pmtiles?: string;
    style_dir?: string;
    /** Set false when 3D Tiles are intentionally unavailable for this city — runtime forces fallback. */
    tiles_available?: boolean;
    /** Set false when per-tile arrow style is intentionally unavailable — runtime degrades to Level 1. */
    style_available?: boolean;
  };
}

export type TileIndex = Record<string, string>;
