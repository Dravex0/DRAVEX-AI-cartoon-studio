import { resolveUniversalSceneTarget } from './universal-scene-target.js';

const clean = value => String(value ?? '').trim();

function fail(reason) {
  return { ok: false, reason };
}

/** Resolve one scene or an explicit allScenes batch for local voice generation. */
export function resolveUniversalVoiceTargets(step, scenes, fallbackIndex = 0) {
  if (!Array.isArray(scenes) || scenes.length === 0) return fail('no-scenes-available');
  const inputs = Array.isArray(step?.inputs) ? step.inputs.map(clean) : [];
  const allScenes = inputs.some(value => /^allScenes$/i.test(value));
  const explicitTokens = inputs.filter(value => /^(sceneId|sceneIndex|sceneNumber)\s*:/i.test(value));
  const naturalSceneTargets = [step?.action, step?.purpose].map(clean).join(' ').match(/\bscene\s*#?\s*\d+\b/gi) || [];
  if (allScenes && (explicitTokens.length || naturalSceneTargets.length)) {
    return fail('conflicting-scene-targets');
  }
  if (allScenes) {
    return { ok: true, allScenes: true, indices: scenes.map((_, index) => index) };
  }
  const target = resolveUniversalSceneTarget(step, scenes, fallbackIndex);
  if (!target.ok) return target;
  return { ok: true, allScenes: false, indices: [target.index], scene: target.scene };
}
