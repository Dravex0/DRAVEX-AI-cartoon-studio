const cleanName = value => String(value ?? '').trim().slice(0, 120);

/**
 * Match only saved character-reference names explicitly present in a source event.
 * If no saved name is mentioned, retain the protagonist as a safe fallback.
 * This is transparent lexical matching, not semantic model inference.
 */
export function inferSceneCast(storyDetail, characterIds = [], protagonist = '') {
  const source = String(storyDetail ?? '').trim();
  const candidates = Array.isArray(characterIds) ? characterIds : [];
  const matches = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const name = cleanName(candidate);
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, 'iu');
    if (pattern.test(source)) matches.push(name);
    if (matches.length >= 12) break;
  }
  if (matches.length) return matches;
  const fallback = cleanName(protagonist);
  return fallback ? [fallback] : [];
}
