import { evaluateStoryboard } from './ai-evaluation.js';
import { normalizeScenes } from './scene-model.js';
import { buildStoryEventChain } from './story-event-chain.js';
import { buildSceneStateMemory, validateSceneStateContinuity } from './scene-state-memory.js';

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

function buildStructuredStateMemory(modelScenes, baselineScenes) {
  const supplied = modelScenes.some(scene =>
    Object.prototype.hasOwnProperty.call(scene, 'startStateData')
    || Object.prototype.hasOwnProperty.call(scene, 'endStateData')
  );
  if (!supplied) return { supplied: false, report: null };

  const scenes = modelScenes.map((scene, index) => {
    if (!Object.prototype.hasOwnProperty.call(scene, 'startStateData')
        || !Object.prototype.hasOwnProperty.call(scene, 'endStateData')) {
      return null;
    }
    const base = baselineScenes[index];
    const stateChanges = (base.stateChanges || []).flatMap(change => {
      const entityType = change.entityType === 'prop' ? 'object'
        : change.entityType === 'character' ? 'character' : null;
      const property = change.property === 'holder' ? 'owner'
        : change.property === 'openState' ? 'state' : change.property;
      if (!entityType || change.value === null || !change.entityId || !property) return [];
      return [{
        entity: change.entityId,
        property,
        previousValue: change.previousValue,
        value: change.value,
        actorId: change.actorId,
        evidence: change.evidence
      }];
    });
    return {
      id: base.id,
      characters: base.characters || [],
      storyDetail: base.storyDetail || '',
      visibleAction: base.visibleAction || '',
      sourceEvents: Array.isArray(base.sourceEvents) ? base.sourceEvents : [],
      startState: scene.startStateData,
      endState: scene.endStateData,
      stateChanges
    };
  });

  if (scenes.some(scene => scene === null)) {
    return {
      supplied: true,
      report: { passed: false, checkedTransitions: 0,
        issues: [{ code: 'structured-state-memory-incomplete', severity: 'error' }] }
    };
  }
  const memory = buildSceneStateMemory(scenes);
  if (!memory) {
    return {
      supplied: true,
      report: { passed: false, checkedTransitions: 0,
        issues: [{ code: 'structured-state-memory-invalid', severity: 'error' }] }
    };
  }
  return { supplied: true, report: validateSceneStateContinuity(memory) };
}

function buildDirectorPrompt({ basePlan, storyText, language, character, characterBible = [], eventChain = null }) {
  const requiredDetails = basePlan.scenes.map((scene, index) => ({
    scene: index + 1,
    sourceDetail: clean(scene.storyDetail, 1_200),
    eventType: clean(scene.storyEventType, 80),
    assignedCharacters: Array.isArray(scene.characters) ? scene.characters : [],
    lockedInteraction: scene.interaction || null,
    lockedCausalLink: scene.causalLink || null,
    lockedStateChanges: scene.stateChanges || []
  }));
  return [
    'You are DRAVEX, a careful animation film director.',
    'Create a scene-by-scene visual direction for the supplied story.',
    'Return ONLY valid JSON with this exact top-level shape: {"scenes":[{"title":"...","purpose":"...","visibleAction":"...","camera":"...","imagePrompt":"...","motionPrompt":"...","startState":"...","endState":"...","startStateData":{...},"endStateData":{...},"actionTimeline":{"schemaVersion":1,"phases":[{"phase":"preparation|action|reaction|result","start":0,"end":1,"actorId":"...","targetId":null,"description":"...","evidence":"exact source-backed phrase"}]}}]}.',
    'Return exactly ' + basePlan.scenes.length + ' scenes, in the same order as the supplied source details.',
    'Each visibleAction must describe one concrete, filmable physical action, not a vague feeling or a static pose.',
    'Make every scene action and camera plan distinct. Use specific shot size, angle, and camera movement.',
    'Do not add characters, events, locations, or props that are not supported by the story.',
    'Keep every character identity unchanged. Use only the character IDs assigned to each locked scene.',
    'Preserve every supplied lockedInteraction exactly: actorId is the acting character, targetId is the recipient, and type is the directed action. Never reverse participants or invent a relationship when lockedInteraction is null.',
    'Preserve every supplied lockedCausalLink exactly. A causal link is valid only when its causeSceneId, effectSceneId, marker, causeEvidence, and evidence remain unchanged. Do not invent causes, consequences, or links when lockedCausalLink is null.',
    'Preserve every supplied lockedStateChanges record exactly, including entity, property, previousValue, value, actorId, and source evidence. Never invent a prop transfer, door state, or character location change.',
    'CHARACTER BIBLE (locked visual references): ' + JSON.stringify(characterBible),
    'Preserve each character\'s visual description, clothing, colors, and distinctive features in every image and motion prompt where that character appears.',
    'Main character reference: ' + clean(character, 120) + '.',
    'Write all scene text in ' + clean(language, 30) + '.',
    'Keep imagePrompt focused on one still frame; keep motionPrompt focused on movement.',
    'For each scene, provide actionTimeline.phases in normalized scene time from 0 to 1. Include only phases supported by the scene: preparation, action, reaction, result. Any supplied timeline must include one central action phase; preparation ends before action, reaction starts after action, and result starts after the action and any reaction. Every phase needs an assigned actorId, a concrete description, and evidence copied exactly from locked storyDetail or sourceEvents. Use only characters assigned to that scene. Do not invent reactions or targets; targetId may be null. If the scene is an establishing shot with no character action, set actionTimeline to null.',
    'Build a strict scene-to-scene hand-off: scene N+1 startState must continue scene N endState. Preserve the exact positions and states of characters, props, clothing, lighting, weather, and location unless the supplied story explicitly changes them.',
    'Do not teleport characters or objects. If a character holds an object at the end of one scene, begin the next scene with that same character still holding it. Carry unresolved actions forward before starting a new action.',
    'Keep startState and endState concrete, visible, and mutually compatible across every adjacent scene.',
    'Also provide startStateData and endStateData as structured JSON objects: {location,time,weather,characters:{characterId:{location,position,pose,clothing}},objects:{objectId:{location,owner,state}}}. Use null for unknown fields, never guess missing facts. Repeat unchanged known values exactly across scene boundaries. These structured fields must agree with the text states.',
    'The source details below are locked facts. Do not rewrite, reorder, omit, or duplicate them.',
    'LOCKED SOURCE DETAILS: ' + JSON.stringify(requiredDetails),
    'LOCKED EVENT CHAIN: ' + JSON.stringify(eventChain),
    'Treat the event chain as immutable source-grounded structure. Preserve actor-to-target direction, explicit consequences, and state changes. Do not invent a reaction-to link or causal edge when it is absent.',
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
  const eventChain = buildStoryEventChain(fallback);
  const fallbackResult = (reason, evaluation = null) => ({
    usedLocalModel: false,
    scenes: fallback,
    evaluation,
    fallbackReason: reason,
    modelId: runtime?.status?.modelId || null,
    eventChain
  });

  if (!runtime || typeof runtime.generate !== 'function') return fallbackResult('local-runtime-unavailable');
  if (!fallback.length) return fallbackResult('baseline-storyboard-empty');

  let generated;
  try {
    generated = await runtime.generate(buildDirectorPrompt({ basePlan: { scenes: fallback }, storyText, language, character, characterBible, eventChain }), {
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
      // Causal attribution is locked to source-grounded deterministic inference.
      causalLink: base.causalLink || null,
      interaction: base.interaction || null,
      stateChanges: base.stateChanges || [],
      visibleAction: clean(scene.visibleAction, 1_000),
      camera: clean(scene.camera, 1_000),
      // These four fields are model deliverables. Do not silently fill omissions from
      // the deterministic baseline, otherwise the production gate cannot detect them.
      imagePrompt: clean(scene.imagePrompt, 4_000),
      motionPrompt: clean(scene.motionPrompt, 3_000),
      startState: clean(scene.startState, 1_000),
      endState: clean(scene.endState, 1_000),
      actionTimeline: scene.actionTimeline ?? null
    };
  }));

  const expectedStoryDetails = fallback.map(scene => clean(scene.storyDetail, 1_200)).filter(Boolean);
  const structuredStateMemory = buildStructuredStateMemory(modelScenes, fallback);
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
  if (structuredStateMemory.supplied) {
    evaluation.structuredStateMemoryReport = structuredStateMemory.report;
    if (!structuredStateMemory.report?.passed) {
      evaluation.issues.push({
        skill: 'structured-state-memory',
        code: 'structured-state-continuity-failed',
        message: 'Structured scene state memory found an incomplete or unexplained state hand-off.'
      });
      evaluation.passed = false;
    }
  }
  if (!evaluation.passed) return fallbackResult('candidate-failed-story-quality-gate', evaluation);

  return {
    usedLocalModel: true,
    scenes: candidate,
    eventChain,
    evaluation,
    fallbackReason: null,
    modelId: generated.modelId || runtime.status?.modelId || null,
    backend: generated.backend || runtime.status?.backend || null
  };
}
