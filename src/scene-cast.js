const MAX_SCENE_CAST = 12;
const clean = value => String(value ?? '').trim().slice(0, 120);

function normalizeList(source) {
  const result = [];
  const seen = new Set();
  for (const item of source) {
    const name = clean(item);
    const key = name.toLocaleLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
    if (result.length >= MAX_SCENE_CAST) break;
  }
  return result;
}

/** Normalize a comma-separated or array scene cast, preserving first-seen order. */
export function normalizeSceneCast(value, fallback = []) {
  const source = Array.isArray(value) ? value : String(value ?? '').split(',');
  const result = normalizeList(source);
  if (result.length) return result;
  // Empty input with no usable fallback must resolve to an empty cast, not recurse forever.
  return normalizeList(Array.isArray(fallback) ? fallback : []);
}
