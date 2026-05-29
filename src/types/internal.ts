import type * as THREE from 'three';
import type { TileLifecycleState } from '../core/TileLifecycle';

export type { TileLifecycleState };

export interface FeatureIdAttribute {
  name: string;
  attribute: THREE.BufferAttribute;
}

export interface TileMeshEntry {
  mesh: THREE.Mesh;
  featureIdAttribute?: FeatureIdAttribute;
}

export interface TileRuntimeHandle {
  tile_content_uri: string;
  object: THREE.Object3D;
  /**
   * Convenience: the first detected feature-id attribute across the tile's
   * meshes. The authoritative per-mesh binding lives on `meshes[i].featureIdAttribute`.
   */
  featureIdAttribute?: FeatureIdAttribute;
  state: TileLifecycleState;
  meshes: TileMeshEntry[];
}

export interface TileColorTexture {
  texture: THREE.DataTexture;
  width: number;
  height: number;
  featureCount: number;
  version: number;
}

export interface PlateauWarning {
  code: string;
  message: string;
  tile_content_uri?: string;
}
