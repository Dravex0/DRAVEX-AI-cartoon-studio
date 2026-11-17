import { validateUniversalTaskPlan } from './universal-task-planner.js';
import { emitProgressSafely } from './progress-callback.js';

const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
const notify = (callback, payload) => emitProgressSafely(
  callback,
  payload,
  error => console.warn('DRAVEX task progress callback failed:', error)
);

function normalizeHandler(entry) {
  if (typeof entry === 'function') return { run: entry, capabilities: null };
  if (!isRecord(entry) || typeof entry.run !== 'function') return null;
  const capabilities = Array.isArray(entry.capabilities)
    ? entry.capabilities.map(value => String(value).trim()).filter(Boolean)
    : null;
  return { run: entry.run, capabilities };
}

function resolveStepHandler(step, handlers) {
  const registry = handlers instanceof Map ? handlers : new Map(Object.entries(handlers || {}));
  const byStepId = normalizeHandler(registry.get(step.id));
  if (byStepId) {
    if (byStepId.capabilities && step.requiredCapabilities.some(capability => !byStepId.capabilities.includes(capability))) {
      return { ok: false, reason: 'handler-missing-required-capability' };
    }
    return { ok: true, handler: byStepId.run };
  }

  if (step.requiredCapabilities.length === 1) {
    const byCapability = normalizeHandler(registry.get(step.requiredCapabilities[0]));
    if (byCapability) return { ok: true, handler: byCapability.run };
  }
  if (step.requiredCapabilities.length > 1) return { ok: false, reason: 'step-handler-required-for-multiple-capabilities' };
  return { ok: false, reason: 'step-handler-not-found' };
}

function normalizeCheckpoint(checkpoint, steps) {
  if (checkpoint == null) return { ok: true, completed: new Set(), results: {} };
  if (!isRecord(checkpoint) || !Array.isArray(checkpoint.completedStepIds) || !isRecord(checkpoint.results || {})) {
    return { ok: false, reason: 'invalid-checkpoint' };
  }
  const known = new Set(steps.map(step => step.id));
  const completed = new Set(checkpoint.completedStepIds);
  if (completed.size !== checkpoint.completedStepIds.length || [...completed].some(id => !known.has(id))) {
    return { ok: false, reason: 'checkpoint-contains-unknown-or-duplicate-step' };
  }
  for (const step of steps) {
    if (completed.has(step.id) && step.dependsOn.some(id => !completed.has(id))) {
      return { ok: false, reason: 'checkpoint-breaks-dependency-order' };
    }
  }
  return { ok: true, completed, results: { ...(checkpoint.results || {}) } };
}

/**
 * Execute a structurally validated plan sequentially.
 *
 * Handler registry keys are step IDs or single required-capability names.
 * For steps requiring multiple capabilities, register a step-ID handler with
 * an explicit capabilities array. A handler receives the plan, step, prior
 * results, AbortSignal, and a progress reporter.
 *
 * Checkpoint persistence is injected by the caller; this module never writes
 * to browser storage or uploads task data.
 */
export async function executeUniversalTaskPlan({
  plan,
  handlers,
  signal,
  checkpoint = null,
  onCheckpoint,
  onProgress
} = {}) {
  if (!isRecord(plan)) return { ok: false, status: 'invalid-plan', reason: 'plan-is-not-an-object' };
  const validation = validateUniversalTaskPlan(plan, plan.sourceRequest);
  if (!validation.ok) return { ok: false, status: 'invalid-plan', reason: validation.reason };
  const validatedPlan = validation.plan;
  const restored = normalizeCheckpoint(checkpoint, validatedPlan.steps);
  if (!restored.ok) return { ok: false, status: 'invalid-checkpoint', reason: restored.reason };

  const completed = restored.completed;
  const results = restored.results;
  const total = validatedPlan.steps.length;
  let completedCount = completed.size;
  notify(onProgress, { status: 'started', completed: completedCount, total, stepId: null, percent: Math.round(completedCount / total * 100) });

  for (const step of validatedPlan.steps) {
    if (completed.has(step.id)) continue;
    if (signal?.aborted) {
      return { ok: false, status: 'cancelled', reason: 'aborted', checkpoint: { completedStepIds: [...completed], results }, completed: completedCount, total };
    }
    if (step.dependsOn.some(id => !completed.has(id))) {
      return { ok: false, status: 'blocked', reason: 'dependency-not-completed', stepId: step.id, checkpoint: { completedStepIds: [...completed], results }, completed: completedCount, total };
    }

    const resolved = resolveStepHandler(step, handlers);
    if (!resolved.ok) {
      return { ok: false, status: 'blocked', reason: resolved.reason, stepId: step.id, checkpoint: { completedStepIds: [...completed], results }, completed: completedCount, total };
    }

    notify(onProgress, { status: 'step-started', completed: completedCount, total, stepId: step.id, percent: Math.round(completedCount / total * 100) });
    let output;
    try {
      output = await resolved.handler({
        plan: validatedPlan,
        step,
        results: Object.freeze({ ...results }),
        signal,
        reportProgress: detail => notify(onProgress, {
          status: 'step-progress',
          stepId: step.id,
          completed: completedCount,
          total,
          percent: Math.round(completedCount / total * 100),
          detail: String(detail ?? '').slice(0, 500)
        })
      });
    } catch (error) {
      const reason = String(error?.message || 'handler-failed').slice(0, 500);
      return { ok: false, status: signal?.aborted ? 'cancelled' : 'failed', reason, stepId: step.id, checkpoint: { completedStepIds: [...completed], results }, completed: completedCount, total };
    }

    // An in-flight browser/model operation may not be interruptible. Never
    // accept its result after cancellation, and never start another step.
    if (signal?.aborted) {
      return { ok: false, status: 'cancelled', reason: 'aborted', checkpoint: { completedStepIds: [...completed], results }, completed: completedCount, total };
    }

    results[step.id] = output;
    completed.add(step.id);
    completedCount += 1;
    const nextCheckpoint = { completedStepIds: [...completed], results: { ...results } };
    try {
      if (typeof onCheckpoint === 'function') await onCheckpoint(nextCheckpoint);
    } catch (error) {
      return { ok: false, status: 'checkpoint-failed', reason: String(error?.message || 'checkpoint-write-failed').slice(0, 500), stepId: step.id, checkpoint: nextCheckpoint, completed: completedCount, total };
    }
    notify(onProgress, { status: 'step-completed', completed: completedCount, total, stepId: step.id, percent: Math.round(completedCount / total * 100) });
  }

  return { ok: true, status: 'completed', results, checkpoint: { completedStepIds: [...completed], results: { ...results } }, completed: completedCount, total, percent: 100 };
}
