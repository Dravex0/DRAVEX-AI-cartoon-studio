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
  const sceneIds = new Set(list.map((scene, index) => clean(scene?.id, 120) || `scene_${index + 1}`));

  list.forEach((scene, index) => {
    const sceneId = clean(scene?.id, 120) || `scene_${index + 1}`;
    const storyEvidence = clean(scene?.storyDetail);
    const characters = unique(scene?.characters);
    const interaction = isRecord(scene?.interaction) ? scene.interaction : null;
    const causalLink = isRecord(scene?.causalLink) ? scene.causalLink : null;
    const stateChanges = (Array.isArray(scene?.stateChanges) ? scene.stateChanges : [])
      .filter(isRecord)
      .map(change => ({
        entityType: clean(change.entityType, 20),
        entityId: clean(change.entityId, 120),
        property: clean(change.property, 40),
        previousValue: change.previousValue == null ? null : clean(change.previousValue, 160),
        value: change.value == null ? null : clean(change.value, 160),
        actorId: clean(change.actorId, 120),
        evidence: clean(change.evidence)
      }));

    const validInteraction = interaction
      && clean(interaction.actorId, 120)
      && clean(interaction.targetId, 120)
      && clean(interaction.evidence)
      && characters.some(name => name.toLocaleLowerCase() === clean(interaction.actorId, 120).toLocaleLowerCase())
      && characters.some(name => name.toLocaleLowerCase() === clean(interaction.targetId, 120).toLocaleLowerCase())
      ? {
          type: clean(interaction.type, 40),
          actorId: clean(interaction.actorId, 120),
          targetId: clean(interaction.targetId, 120),
          evidence: clean(interaction.evidence)
        }
      : null;

    const validCause = causalLink
      && causalLink.type === 'consequence'
      && clean(causalLink.causeSceneId, 120)
      && clean(causalLink.effectSceneId, 120) === sceneId
      && sceneIds.has(clean(causalLink.causeSceneId, 120))
      && clean(causalLink.causeEvidence)
      && clean(causalLink.evidence)
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
