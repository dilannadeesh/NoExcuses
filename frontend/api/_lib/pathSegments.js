// Catch-all routes on Vercel have been unreliable to parse via req.query.path
// -- it can arrive as an array, a bare string, a slash-joined string
// ("users/12"), or under a different key. Rather than guess which, read the
// real request URL first and only fall back to the query param.

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function fromUrl(url, prefix) {
  if (!url) return [];
  const pathname = url.split("?")[0];
  const idx = pathname.indexOf(prefix);
  if (idx === -1) return [];
  const segs = pathname
    .slice(idx + prefix.length)
    .split("/")
    .filter(Boolean)
    .map(safeDecode);
  // If we were handed the internal rewritten URL (it literally contains the
  // "[...path]" filename), that's not the client's real path -- ignore it.
  if (segs.some((s) => s.startsWith("["))) return [];
  return segs;
}

function fromQuery(query) {
  const raw = query?.path ?? query?.["...path"];
  const parts = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  return parts
    .flatMap((p) => String(p).split("/"))
    .filter(Boolean)
    .map(safeDecode);
}

export function getPathSegments(req, prefix) {
  const urlSegments = fromUrl(req.url, prefix);
  return urlSegments.length ? urlSegments : fromQuery(req.query);
}
