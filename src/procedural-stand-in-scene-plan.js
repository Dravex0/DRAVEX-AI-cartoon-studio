import { detectSceneAction } from './scene-action.js';

const clean = (value, max = 120) => String(value ?? '').trim().slice(0, max);
const key = value => clean(value).toLocaleLowerCase();
const validProgress = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

function castPosition(index, count) {
  const presets = {
    1: [0.4],
    2: [0.31, 0.69],
    3: [0.23, 0.5, 0.77],
    4: [0.19, 0.39, 0.61, 0.81]
  };
  const positions = presets[Math.min(4, Math.max(1, count))] || presets[4];
  return { x: positions[index] ?? 0.5, y: 0.75 };
}

function findLayer(scene, characterId) {
  return (Array.isArray(scene?.characterLayers) ? scene.characterLayers : [])
    .find(layer => key(layer?.characterId) === key(characterId)) || null;
}

function findPropAnchor(scene, entityId) {
  const anchors = scene?.propAnchors;
  if (!anchors || typeof anchors !== 'object' || Array.isArray(anchors)) return null;
  const entry = Object.entries(anchors).find(([id, point]) =>
    key(id) === key(entityId) && point && Number.isFinite(point.x) && Number.isFinite(point.y));
  return entry ? { x: entry[1].x, y: entry[1].y } : null;
}

/**
 * Build transparent local stand-ins only for cast members with no authored sprite/rig.
 * Character names, actions and target objects all come from the locked scene record.
 * This is a layout/action fallback, not generated identity artwork.
 */
export function buildProceduralStandInScenePlan(scene = {}, options = {}) {
  const cast = [...new Set((Array.isArray(scene?.characters) ? scene.characters : [])
    .map(value => clean(value))
    .filter(Boolean))].slice(0, 8);
  if (!cast.length) return [];

  const rendered = new Set([
    ...(Array.isArray(options.renderedCharacterIds) ? options.renderedCharacterIds : []),
    ...(Array.isArray(scene?.characterLayers) ? scene.characterLayers.map(layer => layer?.characterId) : []),
    ...(Array.isArray(scene?.characterRigs) ? scene.characterRigs.map(rig => rig?.characterId) : [])
  ].map(key).filter(Boolean));

  const missing = cast.filter(id => !rendered.has(key(id)));
  if (!missing.length) return [];

  const positions = new Map(cast.map((id, index) => {
    const layer = findLayer(scene, id);
    const fallback = castPosition(index, cast.length);
    return [key(id), {
      characterId: id,
      x: Number.isFinite(layer?.x) ? layer.x : fallback.x,
      y: Number.isFinite(layer?.y) ? layer.y : fallback.y
    }];
  }));

  const progress = validProgress(options.progress);
  const phases = Array.isArray(scene?.actionTimeline?.phases) ? scene.actionTimeline.phases : [];
  const states = [
    ...(Array.isArray(scene?.stateChanges) ? scene.stateChanges : []),
    ...(Array.isArray(scene?.propStates) ? scene.propStates : [])
  ].filter(record => record && record.entityType === 'prop');

  return missing.map(characterId => {
    const actorKey = key(characterId);
    const actorPosition = positions.get(actorKey);
    const actorPhases = phases.filter(phase => key(phase?.actorId) === actorKey);
    const activePhase = actorPhases.find(phase =>
      Number.isFinite(phase?.start) && Number.isFinite(phase?.end)
      && progress >= phase.start && progress <= phase.end) || actorPhases[0] || null;
    const heldRecord = [...states].reverse().find(record =>
      record.property === 'holder' && key(record.value) === actorKey) || null;
    const heldTarget = heldRecord
      ? { x: actorPosition.x + 0.12, y: actorPosition.y - 0.08 }
      : null;
    const targetId = clean(activePhase?.targetId);
    let target = null;
    if (targetId) {
      if (heldRecord && key(heldRecord.entityId) === key(targetId)) {
        target = heldTarget;
      } else {
        target = findPropAnchor(scene, targetId);
        if (!target) {
          const targetPosition = positions.get(key(targetId));
          if (targetPosition) target = { x: targetPosition.x, y: targetPosition.y - 0.08 };
          else {
            const targetLayer = findLayer(scene, targetId);
            if (targetLayer && Number.isFinite(targetLayer.x) && Number.isFinite(targetLayer.y)) {
              target = { x: targetLayer.x, y: targetLayer.y - 0.08 };
            }
          }
        }
      }
    }

    const semanticIntent = clean(scene?.semanticActionIntent?.intent, 40);
    const incomingPartnerPhase = phases.find(phase => key(phase?.targetId) === actorKey) || null;
    const isTeamPartner = Boolean(incomingPartnerPhase
      && ['team_magic', 'energy_clash'].includes(semanticIntent));
    const primaryActor = isTeamPartner ? positions.get(key(incomingPartnerPhase.actorId)) : null;
    if (isTeamPartner && primaryActor) {
      target = { x: primaryActor.x, y: primaryActor.y - 0.08 };
    }

    return {
      characterId,
      x: actorPosition.x,
      y: actorPosition.y,
      action: isTeamPartner ? 'magic'
        : activePhase ? detectSceneAction(activePhase.description || scene.storyDetail || '')
          : 'idle',
      target,
      heldTarget,
      held: Boolean(heldRecord),
      targetId: targetId || (isTeamPartner ? clean(incomingPartnerPhase.targetId) : null),
      phase: activePhase?.phase || (isTeamPartner ? incomingPartnerPhase.phase : null)
    };
  });
}
