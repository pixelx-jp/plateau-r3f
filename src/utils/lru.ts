export interface LruOptions<V> {
  max: number;
  onEvict?: (key: string, value: V) => void;
  /**
   * Return true to prevent eviction of an entry. The LRU will skip pinned
   * entries and consider the next oldest. If everything is pinned, the cache
   * exceeds `max` until a pin is released.
   */
  isPinned?: (key: string, value: V) => boolean;
}

export class LruCache<V> {
  private map = new Map<string, V>();
  private readonly max: number;
  private readonly onEvict?: (key: string, value: V) => void;
  private readonly isPinned?: (key: string, value: V) => boolean;

  constructor(opts: LruOptions<V>) {
    this.max = Math.max(1, opts.max);
    this.onEvict = opts.onEvict;
    this.isPinned = opts.isPinned;
  }

  get(key: string): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  peek(key: string): V | undefined {
    return this.map.get(key);
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size <= this.max) return;
    // Walk oldest → newest, skipping pinned entries.
    const overflow = this.map.size - this.max;
    let removed = 0;
    const iter = this.map.keys();
    const toEvict: string[] = [];
    while (removed < overflow) {
      const next = iter.next();
      if (next.done) break;
      const k = next.value as string;
      const v = this.map.get(k)!;
      if (this.isPinned?.(k, v)) continue;
      toEvict.push(k);
      removed++;
    }
    for (const k of toEvict) {
      const v = this.map.get(k)!;
      this.map.delete(k);
      this.onEvict?.(k, v);
    }
  }

  delete(key: string): void {
    const v = this.map.get(key);
    if (v !== undefined) {
      this.map.delete(key);
      this.onEvict?.(key, v);
    }
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    for (const [k, v] of this.map) this.onEvict?.(k, v);
    this.map.clear();
  }

  *entries(): IterableIterator<[string, V]> {
    yield* this.map.entries();
  }
}
