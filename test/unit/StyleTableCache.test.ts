import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tableFromIPC, tableToIPC, tableFromArrays } from 'apache-arrow';

const arrowBytes = (() => {
  const t = tableFromArrays({
    feature_id: new Int32Array([0, 1]),
    year_built: new Float64Array([1970, 2000]),
  });
  return tableToIPC(t, 'file').buffer.slice(0) as ArrayBuffer;
})();

// Mock fetchArrayBuffer to count calls and allow controlled delays.
vi.mock('../../src/loaders/fetchArrayBuffer', () => {
  return {
    fetchArrayBuffer: vi.fn(async (url: string) => {
      // simulate small latency
      await new Promise((r) => setTimeout(r, 5));
      return arrowBytes;
    }),
  };
});

import { fetchArrayBuffer } from '../../src/loaders/fetchArrayBuffer';
import { createStyleTableCache } from '../../src/style/StyleTableCache';

describe('StyleTableCache', () => {
  beforeEach(() => {
    (fetchArrayBuffer as unknown as ReturnType<typeof vi.fn>).mockClear();
  });

  it('decodes arrow and returns a usable StyleTable', async () => {
    const cache = createStyleTableCache({
      resolveUrl: () => 'http://x/test.arrow',
    });
    const t = await cache.get('tile-a');
    expect(t.featureCount).toBe(2);
    expect(t.getNumber(0, 'year_built')).toBe(1970);
  });

  it('dedupes concurrent gets for the same key', async () => {
    const cache = createStyleTableCache({
      resolveUrl: () => 'http://x/test.arrow',
    });
    const [a, b, c] = await Promise.all([
      cache.get('tile-a'),
      cache.get('tile-a'),
      cache.get('tile-a'),
    ]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(fetchArrayBuffer as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
  });

  it('caches and returns same instance on subsequent gets', async () => {
    const cache = createStyleTableCache({
      resolveUrl: () => 'http://x/test.arrow',
    });
    const a = await cache.get('tile-a');
    const b = await cache.get('tile-a');
    expect(a).toBe(b);
    expect(fetchArrayBuffer as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
  });

  it('evicts oldest when over capacity', async () => {
    const cache = createStyleTableCache({
      resolveUrl: (uri) => `http://x/${uri}.arrow`,
      max: 2,
    });
    await cache.get('a');
    await cache.get('b');
    await cache.get('c'); // evicts 'a'
    expect(cache.peek('a')).toBeUndefined();
    expect(cache.peek('b')).toBeDefined();
    expect(cache.peek('c')).toBeDefined();
  });

  it('retain/release adjusts refCount', async () => {
    const cache = createStyleTableCache({
      resolveUrl: () => 'http://x/test.arrow',
    });
    await cache.get('tile-a');
    cache.retain('tile-a');
    cache.retain('tile-a');
    cache.release('tile-a');
    // still alive after one release; entry should still peek
    expect(cache.peek('tile-a')).toBeDefined();
    cache.release('tile-a');
    expect(cache.peek('tile-a')).toBeDefined();
  });

  it('throws when no URL resolver returns nothing', async () => {
    const cache = createStyleTableCache({ resolveUrl: () => undefined });
    await expect(cache.get('tile-x')).rejects.toThrow(/No style URL/);
  });
});
