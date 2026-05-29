import { VectorTile, classifyRings } from '@mapbox/vector-tile';
import Pbf from 'pbf';

export interface FootprintTileFeature {
  rings: Array<Array<[number, number]>>; // in meters, local-tangent-plane (Web Mercator)
  height: number;
  properties: Record<string, number | string | boolean>;
}

const TILE_EXTENT_METERS_AT_Z0 = 40075016.686; // equatorial circumference

function tileBoundsMeters(z: number, x: number, y: number) {
  const n = 2 ** z;
  const size = TILE_EXTENT_METERS_AT_Z0 / n;
  const originX = x * size - TILE_EXTENT_METERS_AT_Z0 / 2;
  // tile y=0 at the top (north). In meters, north is positive.
  const originY = TILE_EXTENT_METERS_AT_Z0 / 2 - y * size;
  return { originX, originY, size };
}

/**
 * Decode all polygon features in the given MVT tile and project them to
 * Web-Mercator meters relative to the world origin. Caller is responsible for
 * choosing a local frame (e.g. subtracting a reference origin).
 */
export function decodePolygonFeatures(
  buf: ArrayBuffer,
  z: number,
  x: number,
  y: number,
  layerName: string,
): FootprintTileFeature[] {
  const tile = new VectorTile(new Pbf(buf));
  const layer = tile.layers[layerName];
  if (!layer) return [];
  const { originX, originY, size } = tileBoundsMeters(z, x, y);
  const out: FootprintTileFeature[] = [];
  for (let i = 0; i < layer.length; i++) {
    const feature = layer.feature(i);
    if (feature.type !== 3) continue; // 3 = Polygon
    const rawRings = feature.loadGeometry();
    // classifyRings splits into [polygon, polygon, ...] where each polygon
    // is [outer, hole?, hole?, ...]. MultiPolygons become >1 polygon.
    const polygons = classifyRings(rawRings);
    const props = feature.properties as Record<string, number | string | boolean>;
    const heightRaw = props.height;
    const height =
      typeof heightRaw === 'number' && Number.isFinite(heightRaw) && heightRaw > 0
        ? heightRaw
        : 6; // safe default in meters
    for (const poly of polygons) {
      const projected: FootprintTileFeature['rings'] = poly.map((ring) =>
        ring.map((p): [number, number] => {
          const lx = originX + (p.x / feature.extent) * size;
          const ly = originY - (p.y / feature.extent) * size;
          return [lx, ly];
        }),
      );
      out.push({ rings: projected, height, properties: props });
    }
  }
  return out;
}

export function tileBounds(z: number, x: number, y: number) {
  return tileBoundsMeters(z, x, y);
}
