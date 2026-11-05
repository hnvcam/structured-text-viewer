// Path helpers for the webview. Paths come from the Bun side and may use either
// separator (Windows), so compare them normalized and case-insensitively.

function normalize(p: string): string {
  const slashed = p.replace(/\\/g, '/');
  return slashed.length > 1 ? slashed.replace(/\/+$/, '') : slashed;
}

export function pathKey(p: string): string {
  return normalize(p).toLowerCase();
}

export function samePath(a: string, b: string): boolean {
  return pathKey(a) === pathKey(b);
}

// True if `p` is `dir` itself or anywhere beneath it.
export function isWithin(p: string, dir: string): boolean {
  const target = pathKey(p);
  const base = pathKey(dir);
  return target === base || target.startsWith(base.endsWith('/') ? base : `${base}/`);
}

export function baseName(p: string): string {
  const n = normalize(p);
  return n.slice(n.lastIndexOf('/') + 1) || n;
}

export function parentPath(p: string): string {
  const n = normalize(p);
  const i = n.lastIndexOf('/');
  return i > 0 ? n.slice(0, i) : n;
}

// Folders between `dir` and the file at `filePath`, e.g. "docs/api" for
// <dir>/docs/api/file.md; "" when the file sits directly in `dir`.
export function relativeDir(filePath: string, dir: string): string {
  if (!isWithin(filePath, dir)) return parentPath(filePath);
  const base = normalize(dir);
  const rel = normalize(filePath).slice(base.length).replace(/^\/+/, '');
  const i = rel.lastIndexOf('/');
  return i > 0 ? rel.slice(0, i) : '';
}
