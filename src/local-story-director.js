import { evaluateStoryboard } from './ai-evaluation.js';
import { normalizeScenes } from './scene-model.js';

const clean = (value, max = 2_000) => String(value ?? '').trim().slice(0, max);
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);

function parseModelScenes(text) {
  const source = clean(text, 100_000)
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  let parsed;
  try { parsed = JSON.parse(source); } catch { return null; }
  if (Array.isArray(parsed)) return parsed;
  return Array.isArray(parsed?.scenes) ? parsed.scenes : null;
}

function buildDirectorPrompt({ basePlan, storyText, language, character, characterBible = [] }) {
  const requiredDetails = basePlan.scenes.map((scene, index) => ({
    scene: index + 1,
    sourceDetail: clean(scene.storyDetail, 1_200),
    eventType: clean(scene.storyEventType, 80),
    assignedCharacters: Array.isArray(scene.characters) ? scene.characters : [],
    lockedInteraction: scene.interaction || null
  }));
  return [
    'You are DRAVEX, a careful animation film director.',
    'Create a scene-by-scene visual direction for the supplied story.',
    'Return ONLY valid JSON with this exact top-level shape: {"scenes":[{"title":"...","purpose":"...","visibleAction":"...","camera":"...","imagePrompt":"...","motionPrompt":"...","startState":"...","endState":"..."}]}.',
    'Return exactly ' + basePlan.scenes.length + ' scenes, in the same order as the supplied source details.',
    'Each visibleAction must describe one concrete, filmable physical action, not a vague feeling or a static pose.',
    'Make every scene action and camera plan distinct. Use specific shot size, angle, and camera movement.',
    'Do not add characters, events, locations, or props that are not supported by the story.',
    'Keep every character identity unchanged. Use only the character IDs assigned to each locked scene.',
    'Preserve every supplied lockedInteraction exactly: actorId is the acting character, targetId is the recipient, and type is the directed action. Never reverse participants or invent a relationship when lockedInteraction is null.',
    'CHARACTER BIBLE (locked visual references): ' + JSON.stringify(characterBible),
    'Preserve each character\'s visual description, clothing, colors, and distinctive features in every image and motion prompt where that character appears.',
    'Main character reference: ' + clean(character, 120) + '.',
    'Write all scene text in ' + clean(language, 30) + '.',
    'Keep imagePrompt focused on one still frame; keep motionPrompt focused on movement.',
    'Build a strict scene-to-scene hand-off: scene N+1 startState must continue scene N endState. Preserve the exact positions and states of characters, props, clothing, lighting, weather, and location unless the supplied story explicitly changes them.',
    'Do not teleport characters or objects. If a character holds an object at the end of one scene, begin the next scene with that same character still holding it. Carry unresolved actions forward before starting a new action.',
    'Keep startState and endState concrete, visible, and mutually compatible across every adjacent scene.',
    'The source details below are locked facts. Do not rewrite, reorder, omit, or duplicate them.',
    'LOCKED SOURCE DETAILS: ' + JSON.stringify(requiredDetails),
    'ORIGINAL STORY: ' + clean(storyText, 12_000)
  ].join('\n\n');
}

/**
 * Use a local language model to direct a deterministic baseline storyboard.
 * Source details, scene order, and character assignments are locked to the baseline.
 * The candidate is accepted only if the text evaluator finds no measurable regression.
 */
export async function directStoryboardWithLocalAI({
  runtime,
  basePlan,
  storyText = '',
  language = 'English',
  character = 'Main character',
  characterBible = [],
  maxNewTokens = 700
} = {}) {
  const fallback = Array.isArray(basePlan?.scenes) ? basePlan.scenes : [];
  const fallbackResult = (reason, evaluation = null) => ({
    usedLocalModel: false,
    scenes: fallback,
    evaluation,
    fallbackReason: reason,
    modelId: runtime?.status?.modelId || null
  });

  if (!runtime || typeof runtime.generate !== 'function') return fallbackResult('local-runtime-unavailable');
  if (!fallback.length) return fallbackResult('baseline-storyboard-empty');

  let generated;
  try {
    generated = await runtime.generate(buildDirectorPrompt({ basePlan: { scenes: fallback }, storyText, language, character, characterBible }), {
      maxNewTokens,
      temperature: 0.15
    });
  } catch (error) {
    return fallbackResult('local-inference-failed: ' + clean(error?.message, 300));
  }

  const modelScenes = parseModelScenes(generated?.text);
  if (!modelScenes || modelScenes.length !== fallback.length || modelScenes.some(scene => !isRecord(scene))) {
    return fallbackResult('invalid-model-scene-structure');
  }

  const candidate = normalizeScenes(modelScenes.map((scene, index) => {
    const base = fallback[index];
    return {
      ...base,
      title: clean(scene.title, 200) || base.title,
      purpose: clean(scene.purpose, 500) || base.purpose,
      // Lock narrative attribution and character membership to the deterministic baseline.
      storyDetail: base.storyDetail,
      storyEventType: base.storyEventType,
      sourceStoryText: base.sourceStoryText,
      sourceEvents: base.sourceEvents,
      characters: Array.isArray(base.characters) && base.characters.length ? base.characters : [clean(character, 120)],
      visibleAction: clean(scene.visibleAction, 1_000),
      camera: clean(scene.camera, 1_000),
      imagePrompt: clean(scene.imagePrompt, 4_000) || base.imagePrompt || base.prompt,
      motionPrompt: clean(scene.motionPrompt, 3_000) || base.motionPrompt,
      startState: clean(scene.startState, 1_000) || base.startState,
      endState: clean(scene.endState, 1_000) || base.endState
    };
  }));

  const expectedStoryDetails = fallback.map(scene => clean(scene.storyDetail, 1_200)).filter(Boolean);
  const evaluation = evaluateStoryboard({
    scenes: candidate,
    expectedSceneCount: fallback.length,
    expectedStoryDetails,
    characterRequirements: candidate.flatMap(scene => (scene.characters.length ? scene.characters : [clean(character, 120)])
      .map(characterId => ({ sceneId: scene.id, characterId }))),
    characterBible,
    requireProductionFields: true,
    requireContinuity: true
  });
  if (!evaluation.passed) return fallbackResult('candidate-failed-story-quality-gate', evaluation);

  return {
    usedLocalModel: true,
    scenes: candidate,
    evaluation,
    fallbackReason: null,
    modelId: generated.modelId || runtime.status?.modelId || null,
    backend: generated.backend || runtime.status?.backend || null
  };
}
