export async function fetchArrayBuffer(
  url: string,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`);
  }
  return res.arrayBuffer();
}
