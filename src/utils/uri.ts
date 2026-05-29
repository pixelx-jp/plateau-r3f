export function joinUrl(base: string, path: string): string {
  if (/^https?:\/\//i.test(path) || path.startsWith('blob:') || path.startsWith('data:')) {
    return path;
  }
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  const p = path.startsWith('/') ? path.slice(1) : path;
  return `${b}/${p}`;
}

export function encodeTileContentUri(uri: string): string {
  return encodeURIComponent(uri);
}

export function normalizeTileContentUri(rawUrl: string, tilesetBase: string): string {
  let url = rawUrl;
  try {
    const u = new URL(rawUrl, tilesetBase);
    const base = new URL(tilesetBase);
    const baseDir = base.pathname.replace(/[^/]+$/, '');
    if (u.origin === base.origin && u.pathname.startsWith(baseDir)) {
      url = u.pathname.slice(baseDir.length);
    } else {
      url = u.toString();
    }
  } catch {
    // leave as-is
  }
  url = url.split('?')[0].split('#')[0];
  if (url.startsWith('./')) url = url.slice(2);
  return url;
}
