/** Provider-neutral, testable scene model; intentionally independent of DOM/network. */
export const SCENE_DURATION_MIN = 0.25;
export const SCENE_DURATION_MAX = 30;
export const DEFAULT_SCENE_DURATION = 3;

import { normalizeCharacterActionTimeline } from './character-action-timeline.js';
import { normalizeCharacterLayers } from './scene-character-layers.js';

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
    characterLayers: normalizeCharacterLayers(scene.characterLayers),
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
    interactions: Array.isArray(scene.interactions) ? scene.interactions.filter(item => item && typeof item === 'object' && !Array.isArray(item)).slice(0, 30).map(item => ({
      type: text(item.type, 40), actorId: text(item.actorId, 120), targetId: text(item.targetId, 120),
      evidence: text(item.evidence, 500),
      sourceStart: Number.isInteger(item.sourceStart) && item.sourceStart >= 0 ? item.sourceStart : null,
      sourceEnd: Number.isInteger(item.sourceEnd) && item.sourceEnd >= 0 ? item.sourceEnd : null
    })) : [],
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
    actionTimeline: normalizeCharacterActionTimeline(scene.actionTimeline),
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
