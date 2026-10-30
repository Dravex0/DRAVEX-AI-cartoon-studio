/** Provider-neutral, testable scene model; intentionally independent of DOM/network. */
export const SCENE_DURATION_MIN = 0.25;
export const SCENE_DURATION_MAX = 30;
export const DEFAULT_SCENE_DURATION = 3;

const text = (value, max = 10_000) => String(value ?? '').trim().slice(0, max);
const uniqueStrings = values => [...new Set((Array.isArray(values) ? values : []).map(value => text(value, 160)).filter(Boolean))];

/** Normalize both current and legacy prototype scene shapes without dropping production prompts. */
export function normalizeScene(input = {}, index = 0) {
  const scene = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  let rawDuration = NaN;
  try { rawDuration = Number(scene.durationSeconds ?? scene.duration); } catch {}
  const durationSeconds = Number.isFinite(rawDuration) && rawDuration >= SCENE_DURATION_MIN && rawDuration <= SCENE_DURATION_MAX
    ? rawDuration : DEFAULT_SCENE_DURATION;
  const prompt = text(scene.prompt ?? scene.visualPrompt);
  const visibleAction = text(scene.visibleAction ?? scene.motion);
  const dialogueSource = Array.isArray(scene.dialogue) ? scene.dialogue : [];
  let orderRaw = NaN, scoreRaw = NaN;
  try { orderRaw = Number(scene.order ?? scene.num); } catch {}
  try { scoreRaw = Number(scene.directorHeuristicScore); } catch {}
  return {
    id: text(scene.id, 120) || `scene_${index + 1}`,
    order: Number.isInteger(orderRaw) && orderRaw > 0 ? orderRaw : index + 1,
    title: text(scene.title, 200) || `Scene ${index + 1}`,
    purpose: text(scene.purpose ?? scene.emotion, 500),
    // Preserve source-story attribution so evaluators and later learning stages can verify fidelity.
    storyDetail: text(scene.storyDetail, 2_000),
    storyEventType: text(scene.storyEventType, 80),
    sourceStoryText: text(scene.sourceStoryText, 10_000),
    sourceEvents: uniqueStrings(scene.sourceEvents),
    characters: uniqueStrings(scene.characters ?? (scene.characterId ? [scene.characterId] : [])),
    interaction: scene.interaction && typeof scene.interaction === 'object' && !Array.isArray(scene.interaction)
      ? {
          type: text(scene.interaction.type, 40),
          actorId: text(scene.interaction.actorId, 120),
          targetId: text(scene.interaction.targetId, 120),
          evidence: text(scene.interaction.evidence, 500)
        }
      : null,
    location: text(scene.location, 500),
    timeOfDay: text(scene.timeOfDay, 120),
    visibleAction,
    camera: text(scene.camera, 1_000),
    startState: text(scene.startState, 1_000),
    endState: text(scene.endState, 1_000),
    dialogue: dialogueSource.map(line => typeof line === 'string'
      ? { characterId: '', text: text(line, 2_000), language: 'en' }
      : { characterId: text(line?.characterId, 120), text: text(line?.text, 2_000), language: text(line?.language, 12) || 'en' })
      .filter(line => line.text),
    sound: text(scene.sound ?? scene.soundCue, 1_000),
    durationSeconds,
    transition: text(scene.transition, 500),
    prompt,
    imagePrompt: text(scene.imagePrompt, 4_000),
    motionPrompt: text(scene.motionPrompt, 3_000),
    negativePrompt: text(scene.negativePrompt, 2_000),
    continuityLock: text(scene.continuityLock, 2_000),
    // Temporary compatibility fields retained during gradual migration.
    emotion: text(scene.emotion, 500),
    effects: text(scene.effects, 1_000),
    directorHeuristicScore: Number.isFinite(scoreRaw) ? Math.max(0, Math.min(100, scoreRaw)) : null
  };
}

export function normalizeScenes(scenes) {
  return Array.isArray(scenes) ? scenes.map((scene, index) => normalizeScene(scene, index)) : [];
}
