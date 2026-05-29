import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  detectFeatureIdAttribute,
  PLATEAU_FEATURE_ID_ATTRIBUTE,
} from '../../src/shader/featureId';
import { applyShaderPatch } from '../../src/shader/ShaderInjector';

function geomWithAttr(name: string): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const values = new Float32Array([0, 1, 2, 3]);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  g.setAttribute(name, new THREE.BufferAttribute(values, 1));
  return g;
}

function makeTexture(): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array(4), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.needsUpdate = true;
  return tex;
}

describe('featureId detection priority', () => {
  it('prefers _FEATURE_ID_0 over other names', () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('_FEATURE_ID_0', new THREE.BufferAttribute(new Float32Array(4), 1));
    g.setAttribute('_BATCHID', new THREE.BufferAttribute(new Float32Array(4), 1));
    g.setAttribute('_feature_id_0', new THREE.BufferAttribute(new Float32Array(4), 1));
    expect(detectFeatureIdAttribute(g)?.name).toBe('_FEATURE_ID_0');
  });

  it('falls through to _BATCHID', () => {
    const g = geomWithAttr('_BATCHID');
    expect(detectFeatureIdAttribute(g)?.name).toBe('_BATCHID');
  });

  it('falls through to _BATCH_ID', () => {
    const g = geomWithAttr('_BATCH_ID');
    expect(detectFeatureIdAttribute(g)?.name).toBe('_BATCH_ID');
  });

  it('falls through to batchId', () => {
    const g = geomWithAttr('batchId');
    expect(detectFeatureIdAttribute(g)?.name).toBe('batchId');
  });

  it('accepts lowercase fallbacks', () => {
    const g = geomWithAttr('_feature_id_0');
    expect(detectFeatureIdAttribute(g)?.name).toBe('_feature_id_0');
  });

  it('returns undefined when no candidate present', () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
    expect(detectFeatureIdAttribute(g)).toBeUndefined();
  });
});

describe('ShaderInjector patching', () => {
  it('patches MeshStandardMaterial and exposes uniforms via userData', () => {
    const geom = geomWithAttr('_FEATURE_ID_0');
    const mat = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(geom, mat);
    const tex = makeTexture();

    applyShaderPatch(mesh, {
      featureIdAttribute: detectFeatureIdAttribute(geom)!,
      colorTexture: { texture: tex, width: 1, height: 1, featureCount: 1, version: 1 },
      opacity: 0.7,
      cacheKeySalt: 'rt-test',
    });

    expect(geom.getAttribute(PLATEAU_FEATURE_ID_ATTRIBUTE)).toBeDefined();
    expect((mat as unknown as { userData: { plateauPatched?: boolean } }).userData.plateauPatched).toBe(true);
    const u = (mat as unknown as { userData: { plateauUniforms?: { uPlateauOpacity: { value: number } } } })
      .userData.plateauUniforms!;
    expect(u.uPlateauOpacity.value).toBe(0.7);
  });

  it('marks ShaderMaterial as unsupported and invokes onUnsupported', () => {
    const geom = geomWithAttr('_FEATURE_ID_0');
    const mat = new THREE.ShaderMaterial();
    const mesh = new THREE.Mesh(geom, mat);
    let unsupportedCalled = false;
    applyShaderPatch(mesh, {
      featureIdAttribute: detectFeatureIdAttribute(geom)!,
      colorTexture: { texture: makeTexture(), width: 1, height: 1, featureCount: 1, version: 1 },
      opacity: 1,
      cacheKeySalt: 'rt-test',
      onUnsupported: () => {
        unsupportedCalled = true;
      },
    });
    expect(unsupportedCalled).toBe(true);
    expect(
      (mat as unknown as { userData: { plateauUnsupported?: boolean } }).userData.plateauUnsupported,
    ).toBe(true);
  });

  it('customProgramCacheKey includes runtime salt', () => {
    const geom = geomWithAttr('_FEATURE_ID_0');
    const mat = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(geom, mat);
    applyShaderPatch(mesh, {
      featureIdAttribute: detectFeatureIdAttribute(geom)!,
      colorTexture: { texture: makeTexture(), width: 1, height: 1, featureCount: 1, version: 1 },
      opacity: 1,
      cacheKeySalt: 'rt-77',
    });
    const key = mat.customProgramCacheKey();
    expect(key).toContain('plateau-v1');
    expect(key).toContain('rt-77');
  });

  it('customProgramCacheKey is stable across calls', () => {
    const geom = geomWithAttr('_FEATURE_ID_0');
    const mat = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(geom, mat);
    applyShaderPatch(mesh, {
      featureIdAttribute: detectFeatureIdAttribute(geom)!,
      colorTexture: { texture: makeTexture(), width: 1, height: 1, featureCount: 1, version: 1 },
      opacity: 1,
      cacheKeySalt: 'rt-stable',
    });
    const k1 = mat.customProgramCacheKey();
    const k2 = mat.customProgramCacheKey();
    expect(k1).toBe(k2);
  });

  it('different runtimes produce different cache keys', () => {
    const make = (salt: string) => {
      const geom = geomWithAttr('_FEATURE_ID_0');
      const mat = new THREE.MeshStandardMaterial();
      const mesh = new THREE.Mesh(geom, mat);
      applyShaderPatch(mesh, {
        featureIdAttribute: detectFeatureIdAttribute(geom)!,
        colorTexture: { texture: makeTexture(), width: 1, height: 1, featureCount: 1, version: 1 },
        opacity: 1,
        cacheKeySalt: salt,
      });
      return mat.customProgramCacheKey();
    };
    expect(make('rt-1')).not.toBe(make('rt-2'));
  });
});
