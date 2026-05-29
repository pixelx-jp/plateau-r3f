import { PMTiles, FetchSource } from 'pmtiles';

export interface PmtilesClient {
  source: PMTiles;
  getTile(z: number, x: number, y: number, signal?: AbortSignal): Promise<ArrayBuffer | undefined>;
  dispose(): void;
}

export function createPmtilesClient(url: string): PmtilesClient {
  const source = new PMTiles(new FetchSource(url));
  return {
    source,
    async getTile(z, x, y, signal) {
      const r = await source.getZxy(z, x, y, signal);
      return r?.data;
    },
    dispose() {
      // pmtiles has no explicit dispose, GC will collect
    },
  };
}
