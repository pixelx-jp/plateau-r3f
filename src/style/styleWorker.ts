/**
 * Companion worker for `createWorkerStyleDecoder`. Compile via your bundler
 * (Vite / Rollup / webpack) with a worker entry. The worker only fetches and
 * forwards bytes — Arrow parsing happens on the main thread so the worker
 * doesn't ship Arrow itself (saves bundle size).
 */
self.addEventListener('message', async (ev: MessageEvent) => {
  const { id, url } = ev.data as { id: number; url: string };
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${url}: ${res.status} ${res.statusText}`);
    const buffer = await res.arrayBuffer();
    (self as unknown as { postMessage(m: unknown, transfer?: Transferable[]): void }).postMessage(
      { id, ok: true, buffer },
      [buffer],
    );
  } catch (err) {
    (self as unknown as { postMessage(m: unknown): void }).postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

export {};
