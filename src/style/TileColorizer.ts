import * as THREE from 'three';
import type { TileColorTexture } from '../types/internal';
import type { StyleTable } from './StyleTable';
import type { CompiledColorBy } from './colorBy';
import type { CompiledHazardLayer } from '../hazards/hazardColor';

function chooseTextureSize(featureCount: number): { width: number; height: number } {
  const w = Math.min(2048, Math.max(1, Math.ceil(Math.sqrt(featureCount))));
  const h = Math.max(1, Math.ceil(featureCount / w));
  return { width: w, height: h };
}

let versionCounter = 0;

export interface TileColorizeInput {
  table: StyleTable;
  colorBy: CompiledColorBy;
  layers: CompiledHazardLayer[];
}

export function buildTileColorTexture(input: TileColorizeInput): TileColorTexture {
  const { table, colorBy, layers } = input;
  // Size the texture to fit max feature_id, not row count — feature_ids may be
  // sparse (e.g. tile_feature_id = 380 in a 295-row table).
  const slotCount = Math.max(table.featureIdMax, table.featureCount);
  const { width, height } = chooseTextureSize(slotCount);
  const rgba = new Uint8Array(width * height * 4);

  for (let fid = 0; fid < slotCount; fid++) {
    const row = table.rowOf(fid);
    let base = colorBy.evaluate(row, table);
    for (const layer of layers) {
      const overlay = layer.evaluate(row, table);
      const alphaT = overlay[3] / 255;
      if (alphaT > 0) {
        const it = 1 - alphaT;
        base = [
          Math.round(base[0] * it + overlay[0] * alphaT),
          Math.round(base[1] * it + overlay[1] * alphaT),
          Math.round(base[2] * it + overlay[2] * alphaT),
          Math.max(base[3], overlay[3]),
        ];
      }
    }
    const i = fid * 4;
    rgba[i] = base[0];
    rgba[i + 1] = base[1];
    rgba[i + 2] = base[2];
    rgba[i + 3] = base[3];
  }

  const texture = new THREE.DataTexture(
    rgba,
    width,
    height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;

  return {
    texture,
    width,
    height,
    featureCount: slotCount,
    version: ++versionCounter,
  };
}
