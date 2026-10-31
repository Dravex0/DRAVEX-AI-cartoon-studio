/**
 * Builds a conservative event graph from already extracted, source-grounded scene metadata.
 * This module does not infer missing actors, reactions, or causes.
 */

const clean = (value, max = 1_200) => String(value ?? '').trim().slice(0, max);
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(value => clean(value, 120)).filter(Boolean))];
}

/**
 * Build a directed event chain.
 * Nodes describe one scene event; edges are emitted only from explicit interaction,
 * causal-link, or state-change metadata already attached to that scene.
 */
export function buildStoryEventChain(scenes = []) {
  const list = Array.isArray(scenes) ? scenes : [];
  const nodes = [];
  const edges = [];
  const knownStates = new Map();
  const sceneIdCounts = new Map();
  const sceneIndexById = new Map();
  list.forEach((scene, index) => {
    const id = clean(scene?.id, 120) || `scene_${index + 1}`;
    sceneIdCounts.set(id, (sceneIdCounts.get(id) || 0) + 1);
    if (!sceneIndexById.has(id)) sceneIndexById.set(id, index);
  });

  list.forEach((scene, index) => {
    const sceneId = clean(scene?.id, 120) || `scene_${index + 1}`;
    const storyEvidence = clean(scene?.storyDetail);
    const characters = unique(scene?.characters);
    const interaction = isRecord(scene?.interaction) ? scene.interaction : null;
    const causalLink = isRecord(scene?.causalLink) ? scene.causalLink : null;
    const stateChanges = [];
    for (const rawChange of (Array.isArray(scene?.stateChanges) ? scene.stateChanges : []).filter(isRecord)) {
      const change = {
        entityType: clean(rawChange.entityType, 20),
        entityId: clean(rawChange.entityId, 120),
        property: clean(rawChange.property, 40),
        previousValue: rawChange.previousValue == null ? null : clean(rawChange.previousValue, 160),
        value: rawChange.value == null ? null : clean(rawChange.value, 160),
        actorId: clean(rawChange.actorId, 120),
        evidence: clean(rawChange.evidence)
      };
      const actorKnown = characters.some(name => name.toLocaleLowerCase() === change.actorId.toLocaleLowerCase());
      const holderKnown = change.value === null || characters.some(name => name.toLocaleLowerCase() === String(change.value).toLocaleLowerCase());
      const validProperty = (change.entityType === 'prop' && ['holder', 'openState'].includes(change.property))
        || (change.entityType === 'character' && change.property === 'location');
      const validValue = (change.property === 'holder' && holderKnown)
        || (change.property === 'openState' && ['open', 'closed'].includes(change.value))
        || (change.property === 'location' && /^(inside|outside):/u.test(String(change.value ?? '')));
      const key = change.entityType + ':' + change.entityId.toLocaleLowerCase() + ':' + change.property;
      const previousMatches = knownStates.has(key)
        ? change.previousValue === knownStates.get(key)
        : change.previousValue === null;
      const valid = Boolean(change.actorId && change.entityId && change.evidence
        && storyEvidence.includes(change.evidence) && actorKnown
        && validProperty && validValue && previousMatches);
      if (!valid) continue;
      stateChanges.push(change);
      knownStates.set(key, change.value);
    }

    const validInteraction = interaction
      && clean(interaction.actorId, 120)
      && clean(interaction.targetId, 120)
      && clean(interaction.evidence)
      && storyEvidence.includes(clean(interaction.evidence))
      && characters.some(name => name.toLocaleLowerCase() === clean(interaction.actorId, 120).toLocaleLowerCase())
      && characters.some(name => name.toLocaleLowerCase() === clean(interaction.targetId, 120).toLocaleLowerCase())
      ? {
          type: clean(interaction.type, 40),
          actorId: clean(interaction.actorId, 120),
          targetId: clean(interaction.targetId, 120),
          evidence: clean(interaction.evidence)
        }
      : null;

    const causeScene = list.find((item, itemIndex) =>
      (clean(item?.id, 120) || `scene_${itemIndex + 1}`) === clean(causalLink?.causeSceneId, 120));
    const causeStoryEvidence = clean(causeScene?.storyDetail);
    const validCause = causalLink
      && causalLink.type === 'consequence'
      && clean(causalLink.causeSceneId, 120)
      && clean(causalLink.effectSceneId, 120) === sceneId
      && sceneIdCounts.get(clean(causalLink.causeSceneId, 120)) === 1
      && sceneIdCounts.get(sceneId) === 1
      && sceneIndexById.get(clean(causalLink.causeSceneId, 120)) < index
      && clean(causalLink.causeEvidence)
      && causeStoryEvidence.includes(clean(causalLink.causeEvidence))
      && clean(causalLink.evidence)
      && storyEvidence.includes(clean(causalLink.evidence))
      ? {
          type: 'consequence',
          causeSceneId: clean(causalLink.causeSceneId, 120),
          effectSceneId: sceneId,
          marker: clean(causalLink.marker, 100),
          causeEvidence: clean(causalLink.causeEvidence),
          evidence: clean(causalLink.evidence)
        }
      : null;

    const node = {
      id: `event_${index + 1}`,
      sceneId,
      sequence: index + 1,
      eventType: clean(scene?.storyEventType, 80) || 'general',
      sourceEvidence: storyEvidence,
      participants: characters,
      action: validInteraction,
      reaction: clean(scene?.storyEventType, 80) === 'emotional_reaction'
        ? { type: 'emotional_reaction', evidence: storyEvidence }
        : null,
      consequence: validCause,
      stateChanges
    };
    nodes.push(node);

    if (validInteraction) {
      edges.push({
        type: 'directed_interaction',
        fromSceneId: sceneId,
        actorId: validInteraction.actorId,
        targetId: validInteraction.targetId,
        evidence: validInteraction.evidence
      });
    }

    if (validCause) {
      edges.push({
        type: 'causes',
        fromSceneId: validCause.causeSceneId,
        toSceneId: validCause.effectSceneId,
        marker: validCause.marker,
        evidence: validCause.evidence,
        causeEvidence: validCause.causeEvidence
      });
    }

    for (const change of stateChanges) {
      if (!change.actorId || !change.entityId || !change.evidence) continue;
      edges.push({
        type: 'changes_state',
        fromSceneId: sceneId,
        actorId: change.actorId,
        entityType: change.entityType,
        entityId: change.entityId,
        property: change.property,
        previousValue: change.previousValue,
        value: change.value,
        evidence: change.evidence
      });
    }

    // A reaction is linked to a prior scene only when the source-grounded causal
    // metadata explicitly identifies that cause. No adjacency-based guessing.
    if (node.reaction && validCause) {
      edges.push({
        type: 'reacts_to',
        fromSceneId: sceneId,
        toSceneId: validCause.causeSceneId,
        evidence: storyEvidence
      });
    }
  });

  return {
    schemaVersion: 1,
    sceneCount: nodes.length,
    nodes,
    edges,
    limitations: [
      'The graph contains only explicit source-grounded interactions, consequences, and state changes.',
      'An emotional reaction is not linked to a cause unless an explicit causal link is present.',
      'Missing actors, targets, reactions, and implicit causes are not inferred.'
    ]
  };
}
