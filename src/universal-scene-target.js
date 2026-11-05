const clean = value => String(value ?? '').trim();

function fail(reason) {
  return { ok: false, reason };
}

/**
 * Resolve a scene target explicitly named by a universal plan step.
 * Supported input tokens: sceneId:<id>, sceneIndex:<zero-based>, sceneNumber:<one-based>.
 * Natural-language "scene N" in action/purpose is accepted as a one-based number.
 */
export function resolveUniversalSceneTarget(step, scenes, fallbackIndex = 0) {
  if (!Array.isArray(scenes) || scenes.length === 0) return fail('no-scenes-available');
  const candidates = [];
  for (const input of Array.isArray(step?.inputs) ? step.inputs : []) {
    const value = clean(input);
    let match = value.match(/^sceneId\s*:\s*(.+)$/i);
    if (match) candidates.push({ type: 'id', value: clean(match[1]) });
    match = value.match(/^sceneIndex\s*:\s*(\d+)$/i);
    if (match) candidates.push({ type: 'index', value: Number(match[1]) });
    match = value.match(/^sceneNumber\s*:\s*(\d+)$/i);
    if (match) candidates.push({ type: 'number', value: Number(match[1]) });
  }

  if (candidates.length === 0) {
    const description = [step?.action, step?.purpose].map(clean).join(' ');
    const matches = [...description.matchAll(/\bscene\s*#?\s*(\d+)\b/gi)];
    const distinct = [...new Set(matches.map(match => Number(match[1])))];
    if (distinct.length > 1) return fail('conflicting-scene-targets');
    if (distinct.length === 1) candidates.push({ type: 'number', value: distinct[0] });
  }
  if (candidates.length > 1) {
    const signatures = new Set(candidates.map(item => item.type + ':' + item.value));
    if (signatures.size > 1) return fail('conflicting-scene-targets');
  }

  const target = candidates[0];
  let index = Number.isInteger(fallbackIndex) ? fallbackIndex : 0;
  if (target?.type === 'id') {
    index = scenes.findIndex(scene => clean(scene?.id) === target.value);
    if (index < 0) return fail('unknown-scene-id');
  } else if (target?.type === 'index') {
    index = target.value;
  } else if (target?.type === 'number') {
    index = target.value - 1;
  }
  if (!Number.isInteger(index) || index < 0 || index >= scenes.length) return fail('scene-index-out-of-range');
  return { ok: true, index, scene: scenes[index], explicit: Boolean(target) };
}
