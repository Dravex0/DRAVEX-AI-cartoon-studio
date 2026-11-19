import { buildSceneWorldModel } from './scene-world-model.js';
import { buildScenePhysicsModel } from './scene-physics-model.js';
import { buildSceneCausalModel } from './scene-causal-model.js';
import { buildSemanticEditingPlan } from './semantic-editing-plan.js';
import { buildEditDecisionPlan } from './edit-decision-engine.js';
import { buildSceneProductionPlan } from './scene-production-plan.js';
import { buildSceneStateMemory, validateSceneStateContinuity } from './scene-state-memory.js';
import { buildSceneFilmMemory } from './scene-film-memory.js';

/**
 * Assemble the complete deterministic production context for the exact scene
 * list about to be rendered. Rebuild it at render time so edited scenes,
 * dialogue, props and action timing cannot leave a stale storyboard plan.
 */
export function buildSceneProductionContext(scenes = [], options = {}) {
  const list = Array.isArray(scenes)
    ? scenes.filter(scene => scene && typeof scene === 'object' && !Array.isArray(scene))
    : [];
  const language = String(options.language || 'en');
  const worldModel = buildSceneWorldModel(list, { language });
  const physicsModel = buildScenePhysicsModel(list, worldModel);
  const causalModel = buildSceneCausalModel(list, worldModel, physicsModel);
  const editingPlan = buildSemanticEditingPlan(list, worldModel);
  const editDecisions = buildEditDecisionPlan(editingPlan, list, worldModel);
  const productionPlan = buildSceneProductionPlan(list, {
    worldModel, physicsModel, causalModel, editingPlan, editDecisions
  });
  const stateMemory = buildSceneStateMemory(list);
  const stateContinuity = validateSceneStateContinuity(stateMemory);
  productionPlan.continuityValidation = stateContinuity;
  const filmMemory = buildSceneFilmMemory(list, {
    worldModel, physicsModel, causalModel, stateContinuity
  });
  const filmScenes = new Map(filmMemory.scenes.map(scene => [scene.sceneId, scene]));
  for (const scenePlan of productionPlan.scenes) {
    scenePlan.continuityIssues = stateContinuity.issues.filter(issue =>
      issue.sceneId === scenePlan.sceneId || issue.previousSceneId === scenePlan.sceneId
    );
    const memoryScene = filmScenes.get(scenePlan.sceneId);
    if (!memoryScene) continue;
    const previousMemory = filmMemory.scenes[memoryScene.order - 2] || null;
    const summarizeBoundary = memory => memory ? ({
      sceneId: memory.sceneId,
      title: memory.title,
      environment: memory.environment,
      endState: memory.state.end,
      characters: memory.characters.map(entity => ({ id: entity.id, kind: entity.kind })),
      objects: memory.objects.map(entity => ({ id: entity.id, kind: entity.kind })),
      finalEvents: memory.timeline.slice(-6),
      holderTransitions: memory.holderTransitions.slice(-6)
    }) : null;
    scenePlan.filmMemoryContext = {
      schemaVersion: filmMemory.schemaVersion,
      sceneOrder: memoryScene.order,
      sceneCount: filmMemory.sceneCount,
      previousScene: summarizeBoundary(previousMemory),
      currentScene: {
        sceneId: memoryScene.sceneId,
        environment: memoryScene.environment,
        entities: memoryScene.entities.map(entity => ({
          id: entity.id, kind: entity.kind, attributes: entity.attributes
        })),
        startState: memoryScene.state.start,
        endState: memoryScene.state.end,
        stateChanges: memoryScene.state.changes,
        timeline: memoryScene.timeline.slice(0, 12),
        holderTransitions: memoryScene.holderTransitions.slice(0, 12),
        causalEdges: memoryScene.causalEdges.slice(0, 12)
      },
      continuityIssues: memoryScene.continuityIssues
    };
  }
  productionPlan.filmMemory = {
    schemaVersion: filmMemory.schemaVersion,
    sceneCount: filmMemory.sceneCount,
    entityCount: filmMemory.entityCount,
    eventCount: filmMemory.eventCount,
    continuity: filmMemory.continuity,
    issues: filmMemory.issues
  };
  return { worldModel, physicsModel, causalModel, editingPlan, editDecisions,
    stateMemory, stateContinuity, filmMemory, productionPlan };
}
