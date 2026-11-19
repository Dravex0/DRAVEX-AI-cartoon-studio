import { buildSceneWorldModel } from './scene-world-model.js';
import { buildScenePhysicsModel } from './scene-physics-model.js';
import { buildSceneCausalModel } from './scene-causal-model.js';
import { buildSemanticEditingPlan } from './semantic-editing-plan.js';
import { buildEditDecisionPlan } from './edit-decision-engine.js';
import { buildSceneProductionPlan } from './scene-production-plan.js';
import { buildSceneStateMemory, validateSceneStateContinuity } from './scene-state-memory.js';

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
  for (const scenePlan of productionPlan.scenes) {
    scenePlan.continuityIssues = stateContinuity.issues.filter(issue =>
      issue.sceneId === scenePlan.sceneId || issue.previousSceneId === scenePlan.sceneId
    );
  }
  return { worldModel, physicsModel, causalModel, editingPlan, editDecisions,
    stateMemory, stateContinuity, productionPlan };
}
