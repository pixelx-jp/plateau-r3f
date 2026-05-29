import * as THREE from 'three';
import type { FeatureIdAttribute } from '../types/internal';

const FEATURE_ID_CANDIDATES = [
  '_FEATURE_ID_0',
  '_BATCHID',
  '_BATCH_ID',
  'batchId',
  '_feature_id_0',
  '_batchid',
];

export function detectFeatureIdAttribute(
  geometry: THREE.BufferGeometry,
): FeatureIdAttribute | undefined {
  for (const name of FEATURE_ID_CANDIDATES) {
    const attr = geometry.getAttribute(name);
    if (attr) return { name, attribute: attr as THREE.BufferAttribute };
  }
  // also check userData mapping that some 3D Tiles loaders set
  return undefined;
}

const SHADER_ATTRIBUTE_NAME = 'plateauFeatureId';

export function bindFeatureIdAttribute(
  geometry: THREE.BufferGeometry,
  attr: FeatureIdAttribute,
): void {
  if (!geometry.getAttribute(SHADER_ATTRIBUTE_NAME)) {
    geometry.setAttribute(SHADER_ATTRIBUTE_NAME, attr.attribute);
  }
}

export const PLATEAU_FEATURE_ID_ATTRIBUTE = SHADER_ATTRIBUTE_NAME;
