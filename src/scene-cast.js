const MAX_SCENE_CAST = 12;
const clean = value => String(value ?? '').trim().slice(0, 120);

/** Normalize a comma-separated or array scene cast, preserving first-seen order. */
export function normalizeSceneCast(value, fallback = []) {
  const source = Array.isArray(value)
    ? value
    : String(value ?? '').split(',');
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
  if (result.length) return result;
  return normalizeSceneCast(Array.isArray(fallback) ? fallback : []);
}
