import { createStyleTable, type StyleTable } from './StyleTable';
import { decodeArrowTable } from '../loaders/decodeArrowTable';

/**
 * A starter Worker-backed Arrow decoder. The bundled worker script fetches
 * the URL inside the worker, parses Arrow IPC there, and posts the resulting
 * raw IPC bytes back to the main thread (zero-copy via transferables). The
 * main thread re-parses and wraps with `createStyleTable`.
 *
 * For most cities the main-thread decode is already <100µs per tile; only
 * reach for this when tile arrow files exceed ~10k rows or your scene
 * exhausts the main-thread budget.
 *
 * Usage:
 *
 *   const decoder = createWorkerStyleDecoder(
 *     new Worker(new URL('./styleWorker.js', import.meta.url), { type: 'module' }),
 *   );
 *   <Plateau city="..." styleDecoder={decoder} />
 */
export function createWorkerStyleDecoder(
  worker: Worker,
): (uri: string, url: string, signal?: AbortSignal) => Promise<StyleTable> {
  let nextId = 1;
  type Pending = { resolve: (b: ArrayBuffer) => void; reject: (e: unknown) => void };
  const pending = new Map<number, Pending>();
  worker.addEventListener('message', (ev) => {
    const { id, ok, buffer, error } = ev.data as {
      id: number;
      ok: boolean;
      buffer?: ArrayBuffer;
      error?: string;
    };
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (ok && buffer) p.resolve(buffer);
    else p.reject(new Error(error ?? 'worker decode failed'));
  });

  return (uri, url, signal) => {
    const id = nextId++;
    return new Promise<StyleTable>((resolve, reject) => {
      const onAbort = () => {
        pending.delete(id);
        reject(new DOMException('aborted', 'AbortError'));
      };
      signal?.addEventListener('abort', onAbort);
      pending.set(id, {
        resolve: (buffer) => {
          signal?.removeEventListener('abort', onAbort);
          try {
            const table = decodeArrowTable(buffer);
            resolve(createStyleTable(table, uri));
          } catch (err) {
            reject(err);
          }
        },
        reject: (err) => {
          signal?.removeEventListener('abort', onAbort);
          reject(err);
        },
      });
      worker.postMessage({ id, url });
    });
  };
}
