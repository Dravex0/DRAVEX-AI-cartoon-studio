import { validateCharacterFacialRig } from "./character-facial-rig.js";
import { shouldShowProceduralDemoCharacter } from "./demo-character-mode.js";

const cleanKey = value => String(value ?? "").trim().toLowerCase();

function hasRenderableMouthRig(scene, track) {
  const speakerKeys = new Set([track?.characterId, track?.characterName]
    .map(cleanKey)
    .filter(Boolean));
  if (!speakerKeys.size) return false;

  const bodyRigs = Array.isArray(scene?.characterRigs) ? scene.characterRigs : [];
  const facialRigs = Array.isArray(scene?.characterFacialRigs) ? scene.characterFacialRigs : [];
  return facialRigs.some(rig => {
    const rigKey = cleanKey(rig?.characterId);
    if (!rigKey || !speakerKeys.has(rigKey)) return false;
    const bodyRig = bodyRigs.find(item => cleanKey(item?.characterId) === rigKey) || null;
    const report = validateCharacterFacialRig(rig, bodyRig);
    return report.passed && report.rig.parts.some(part => part.role === "mouth");
  });
}

/**
 * Keep only dialogue tracks whose mouths can actually be rendered.
 * A generated character needs a valid facial rig with a mouth image; the
 * built-in procedural demo character has its own Canvas mouth renderer.
 */
export function selectRenderableLipSyncTracks({
  voiceTracks = [],
  sceneMetadata = [],
  mainCharacterKey = "",
  storyUsesFallback = false
} = {}) {
  if (!Array.isArray(voiceTracks) || !Array.isArray(sceneMetadata)) return [];
  const mainKey = cleanKey(mainCharacterKey);
  return voiceTracks.filter(track => {
    const sceneIndex = Number(track?.sceneIndex);
    if (!Number.isInteger(sceneIndex) || sceneIndex < 0) return false;
    const scene = sceneMetadata[sceneIndex] || {};
    if (hasRenderableMouthRig(scene, track)) return true;
    if (!mainKey || cleanKey(track?.characterName) !== mainKey) return false;
    return shouldShowProceduralDemoCharacter({
      storyUsesFallback,
      hasCharacterLayers: Array.isArray(scene.characterLayers) && scene.characterLayers.length > 0
    });
  });
}
