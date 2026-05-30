import { LruCache } from '../utils/lru';
import { fetchArrayBuffer } from '../loaders/fetchArrayBuffer';
import { decodeArrowTable } from '../loaders/decodeArrowTable';
import { createStyleTable, type StyleTable } from './StyleTable';

interface CacheEntry {
  table: StyleTable;
  refCount: number;
  lastReleaseAt: number;
}

export interface StyleTableCacheOptions {
  resolveUrl: (tile_content_uri: string) => string | undefined;
  max?: number;
  releaseDelayMs?: number;
  /**
   * Optional override for the fetch → decode pipeline. The default reads the
   * URL via `fetch`, decodes Arrow IPC on the main thread, and wraps the
   * table with `createStyleTable`. Plug your own implementation (e.g. a
   * Worker-backed decoder) for very large tiles.
   */
  decoder?: (
    tile_content_uri: string,
    url: string,
    signal?: AbortSignal,
  ) => Promise<StyleTable>;
}

export interface StyleTableCache {
  get(tile_content_uri: string, signal?: AbortSignal): Promise<StyleTable>;
  peek(tile_content_uri: string): StyleTable | undefined;
  retain(tile_content_uri: string): void;
  release(tile_content_uri: string): void;
  dispose(): void;
}

export function createStyleTableCache(opts: StyleTableCacheOptions): StyleTableCache {
  // Large default. Wards like Chiyoda have ~1.6k tiles; Kamakura ~2.7k. With
  // refCount pinning, visible tiles are safe past the cap; only background /
  // off-screen tiles are eligible for eviction.
  const max = opts.max ?? 4096;
  const releaseDelayMs = opts.releaseDelayMs ?? 5000;

  const lru = new LruCache<CacheEntry>({
    max,
    isPinned: (_k, v) => v.refCount > 0,
    onEvict: () => {
      /* Arrow table is GC'd, nothing to dispose */
    },
  });

  const inflight = new Map<string, Promise<StyleTable>>();

  let disposed = false;

  async function load(tile_content_uri: string, signal?: AbortSignal): Promise<StyleTable> {
    const url = opts.resolveUrl(tile_content_uri);
    if (!url) {
      throw new Error(`No style URL for tile_content_uri "${tile_content_uri}"`);
    }
    if (opts.decoder) {
      return opts.decoder(tile_content_uri, url, signal);
    }
    const buf = await fetchArrayBuffer(url, signal);
    const table = decodeArrowTable(buf);
    return createStyleTable(table, tile_content_uri);
  }

  return {
    async get(tile_content_uri, signal) {
      if (disposed) throw new Error('StyleTableCache disposed');
      const cached = lru.get(tile_content_uri);
      if (cached) return cached.table;
      const pending = inflight.get(tile_content_uri);
      if (pending) return pending;
      const p = load(tile_content_uri, signal)
        .then((table) => {
          inflight.delete(tile_content_uri);
          if (disposed) return table;
          lru.set(tile_content_uri, { table, refCount: 0, lastReleaseAt: 0 });
          return table;
        })
        .catch((err) => {
          inflight.delete(tile_content_uri);
          throw err;
        });
      inflight.set(tile_content_uri, p);
      return p;
    },
    peek(tile_content_uri) {
      return lru.peek(tile_content_uri)?.table;
    },
    retain(tile_content_uri) {
      const e = lru.peek(tile_content_uri);
      if (e) e.refCount += 1;
    },
    release(tile_content_uri) {
      const e = lru.peek(tile_content_uri);
      if (!e) return;
      e.refCount = Math.max(0, e.refCount - 1);
      e.lastReleaseAt = performance.now();
      // Eviction is handled lazily by LRU; we do not force-drop here
      // so that quick re-fetches don't pay decode cost again.
      if (e.refCount === 0 && releaseDelayMs <= 0) {
        lru.delete(tile_content_uri);
      }
    },
    dispose() {
      disposed = true;
      lru.clear();
      inflight.clear();
    },
  };
}
