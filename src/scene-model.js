/** Return the single active speaker line at scene-local playback time. */
export function getActiveSceneDialogue(scene, timeSeconds = 0) {
  const time = Number.isFinite(Number(timeSeconds)) ? Math.max(0, Number(timeSeconds)) : 0;
  const lines = Array.isArray(scene?.dialogueTimeline) ? scene.dialogueTimeline : [];
  return lines.find(line => Number.isFinite(Number(line?.startSeconds))
    && Number.isFinite(Number(line?.endSeconds))
    && time >= Number(line.startSeconds)
    && time < Number(line.endSeconds)
    && typeof line?.text === 'string' && line.text.trim()
    && typeof line?.characterId === 'string' && line.characterId.trim()) || null;
}

import { normalizeSceneInteraction, validateSceneInteractions } from './scene-interactions.js';
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
  const characters = uniqueStrings(scene.characters ?? (scene.characterId ? [scene.characterId] : []));
  const interactions = (Array.isArray(scene.interactions) ? scene.interactions : []).slice(0, 30)
    .map((event, eventIndex) => normalizeSceneInteraction(event, eventIndex, durationSeconds));
  const interactionIssues = validateSceneInteractions(interactions, characters, durationSeconds).issues;
  const emotionTimeline = (Array.isArray(scene.emotionTimeline) ? scene.emotionTimeline : []).slice(0, 30)
    .map(item => {
      let start = NaN, end = NaN;
      try { start = Number(item?.startSeconds); end = Number(item?.endSeconds); } catch {}
      return { startSeconds: Number.isFinite(start) ? Math.max(0, Math.min(durationSeconds, start)) : 0,
        endSeconds: Number.isFinite(end) ? Math.max(0, Math.min(durationSeconds, end)) : 0,
        emotion: text(item?.emotion, 40).toLowerCase() };
    })
    .filter(item => item.endSeconds > item.startSeconds && ['neutral', 'happy', 'sad', 'fear', 'anger', 'surprised'].includes(item.emotion))
    .sort((a, b) => a.startSeconds - b.startSeconds);
  const rawDialogueTimeline = Array.isArray(scene.dialogueTimeline) ? scene.dialogueTimeline : [];
  const dialogueTimeline = rawDialogueTimeline.slice(0, 20).map((line, lineIndex) => {
    let start = NaN, end = NaN;
    try { start = Number(line?.startSeconds); end = Number(line?.endSeconds); } catch {}
    return { id: text(line?.id, 120) || `dialogue_${lineIndex + 1}`,
      characterId: text(line?.characterId, 120), text: text(line?.text, 2_000),
      startSeconds: Number.isFinite(start) ? Math.max(0, Math.min(durationSeconds, start)) : 0,
      endSeconds: Number.isFinite(end) ? Math.max(0, Math.min(durationSeconds, end)) : 0 };
  }).filter(line => line.text && line.characterId && line.endSeconds > line.startSeconds);
  const dialogueTimelineIssues = dialogueTimeline.filter(line => characters.length && !characters.includes(line.characterId))
    .map(line => ({ code: 'DIALOGUE_SPEAKER_NOT_IN_SCENE', characterId: line.characterId, lineId: line.id }));
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
    characters,
    causalLink: scene.causalLink && typeof scene.causalLink === 'object' && !Array.isArray(scene.causalLink)
      ? {
          type: text(scene.causalLink.type, 40),
          causeSceneId: text(scene.causalLink.causeSceneId, 120),
          effectSceneId: text(scene.causalLink.effectSceneId, 120),
          marker: text(scene.causalLink.marker, 100),
          causeEvidence: text(scene.causalLink.causeEvidence, 1_200),
          evidence: text(scene.causalLink.evidence, 1_200)
        }
      : null,
    stateChanges: Array.isArray(scene.stateChanges) ? scene.stateChanges.filter(change => change && typeof change === 'object' && !Array.isArray(change)).slice(0, 30).map(change => ({
      entityType: text(change.entityType, 20),
      entityId: text(change.entityId, 120),
      property: text(change.property, 40),
      previousValue: change.previousValue == null ? null : text(change.previousValue, 160),
      value: change.value == null ? null : text(change.value, 160),
      actorId: text(change.actorId, 120),
      evidence: text(change.evidence, 1_200)
    })) : [],
    interactions,
    interactionIssues,
    emotionTimeline,
    dialogueTimeline,
    dialogueTimelineIssues,
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
