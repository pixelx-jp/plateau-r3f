import * as THREE from 'three';
import type { FeatureIdAttribute, TileColorTexture } from '../types/internal';
import {
  bindFeatureIdAttribute,
  PLATEAU_FEATURE_ID_ATTRIBUTE,
} from './featureId';
import {
  FRAGMENT_BODY,
  FRAGMENT_HEADER,
  VERTEX_BODY,
  VERTEX_HEADER,
} from './shaderChunks';

export interface ShaderLike {
  uniforms: Record<string, THREE.IUniform>;
  vertexShader: string;
  fragmentShader: string;
}

export interface ShaderExtension {
  id: string;
  uniforms?: Record<string, THREE.IUniform>;
  apply(shader: ShaderLike): void;
}

export interface ShaderPatchState {
  featureIdAttribute: FeatureIdAttribute;
  colorTexture: TileColorTexture;
  opacity: number;
  cacheKeySalt: string;
  extensions?: ShaderExtension[];
  onUnsupported?: (material: THREE.Material) => void;
}

interface PatchedMaterial extends THREE.Material {
  userData: {
    plateauPatched?: boolean;
    plateauCacheKey?: string;
    plateauUnsupported?: boolean;
    plateauUniforms?: {
      uPlateauColorTex: { value: THREE.Texture | null };
      uPlateauColorTexSize: { value: THREE.Vector2 };
      uPlateauOpacity: { value: number };
    };
  };
}

const VERTEX_HOOK = '#include <common>';
const VERTEX_BEGIN_HOOK = '#include <begin_vertex>';
const FRAGMENT_HOOK = '#include <common>';
const FRAGMENT_DIFFUSE_HOOK = 'vec4 diffuseColor = vec4( diffuse, opacity );';

function shaderSupports(material: THREE.Material): boolean {
  // ShaderMaterial subclasses have user-defined shaders; our chunk insertion
  // won't match. Plain Material has no shader at all.
  if ((material as { isShaderMaterial?: boolean }).isShaderMaterial) return false;
  const type = material.type;
  return /MeshStandardMaterial|MeshPhysicalMaterial|MeshLambertMaterial|MeshPhongMaterial|MeshBasicMaterial|MeshToonMaterial/.test(
    type,
  );
}

function patchMaterial(
  material: THREE.Material,
  cacheKeySalt: string,
  extensions: ShaderExtension[] | undefined,
  onUnsupported: ((m: THREE.Material) => void) | undefined,
): PatchedMaterial | null {
  const pm = material as PatchedMaterial;
  if (pm.userData.plateauUnsupported) return null;
  if (pm.userData.plateauPatched) return pm;
  if (!shaderSupports(material)) {
    pm.userData.plateauUnsupported = true;
    onUnsupported?.(material);
    return null;
  }

  pm.userData.plateauUniforms = {
    uPlateauColorTex: { value: null },
    uPlateauColorTexSize: { value: new THREE.Vector2(1, 1) },
    uPlateauOpacity: { value: 1.0 },
  };
  pm.userData.plateauCacheKey = cacheKeySalt;

  const extList = extensions ?? [];

  const prev = material.onBeforeCompile?.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    const u = pm.userData.plateauUniforms!;
    shader.uniforms.uPlateauColorTex = u.uPlateauColorTex;
    shader.uniforms.uPlateauColorTexSize = u.uPlateauColorTexSize;
    shader.uniforms.uPlateauOpacity = u.uPlateauOpacity;
    for (const ext of extList) {
      if (ext.uniforms) {
        for (const [k, v] of Object.entries(ext.uniforms)) {
          shader.uniforms[k] = v;
        }
      }
    }

    let v = shader.vertexShader;
    let f = shader.fragmentShader;

    const beforeV = v;
    if (v.includes(VERTEX_HOOK)) {
      v = v.replace(VERTEX_HOOK, `${VERTEX_HOOK}\n${VERTEX_HEADER}`);
    } else {
      v = `${VERTEX_HEADER}\n${v}`;
    }
    if (v.includes(VERTEX_BEGIN_HOOK)) {
      v = v.replace(VERTEX_BEGIN_HOOK, `${VERTEX_BEGIN_HOOK}\n${VERTEX_BODY}`);
    } else {
      // Fall back to injecting in main() — rare. Mark unsupported instead.
      pm.userData.plateauUnsupported = true;
      onUnsupported?.(material);
      v = beforeV;
      return;
    }

    if (f.includes(FRAGMENT_HOOK)) {
      f = f.replace(FRAGMENT_HOOK, `${FRAGMENT_HOOK}\n${FRAGMENT_HEADER}`);
    } else {
      f = `${FRAGMENT_HEADER}\n${f}`;
    }
    if (f.includes(FRAGMENT_DIFFUSE_HOOK)) {
      f = f.replace(FRAGMENT_DIFFUSE_HOOK, `${FRAGMENT_DIFFUSE_HOOK}\n${FRAGMENT_BODY}`);
    } else {
      pm.userData.plateauUnsupported = true;
      onUnsupported?.(material);
      return;
    }

    shader.vertexShader = v;
    shader.fragmentShader = f;

    for (const ext of extList) {
      try {
        ext.apply(shader);
      } catch (err) {
        console.warn('[plateau-r3f] shader extension failed', ext.id, err);
      }
    }
  };

  const prevCacheKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => {
    const base = prevCacheKey ? prevCacheKey() : '';
    const extIds = extList.map((e) => e.id).join(',');
    return `${base}|plateau-v1|${cacheKeySalt}|${extIds}`;
  };

  material.transparent = true;
  material.needsUpdate = true;
  pm.userData.plateauPatched = true;
  return pm;
}

export function applyShaderPatch(
  mesh: THREE.Mesh,
  state: ShaderPatchState,
): void {
  bindFeatureIdAttribute(mesh.geometry, state.featureIdAttribute);
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const m of materials) {
    const pm = patchMaterial(
      m as THREE.Material,
      state.cacheKeySalt,
      state.extensions,
      state.onUnsupported,
    );
    if (!pm) continue;
    const u = pm.userData.plateauUniforms!;
    u.uPlateauColorTex.value = state.colorTexture.texture;
    u.uPlateauColorTexSize.value.set(state.colorTexture.width, state.colorTexture.height);
    u.uPlateauOpacity.value = state.opacity;
  }
}

export function updateShaderUniforms(
  mesh: THREE.Mesh,
  colorTexture: TileColorTexture,
  opacity: number,
): void {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const m of materials) {
    const pm = m as PatchedMaterial;
    const u = pm.userData?.plateauUniforms;
    if (!u) continue;
    u.uPlateauColorTex.value = colorTexture.texture;
    u.uPlateauColorTexSize.value.set(colorTexture.width, colorTexture.height);
    u.uPlateauOpacity.value = opacity;
  }
}

export { PLATEAU_FEATURE_ID_ATTRIBUTE };
