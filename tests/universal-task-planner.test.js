import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUniversalPlannerPrompt,
  planUniversalTask,
  validateUniversalTaskPlan
} from '../src/universal-task-planner.js';

const request = 'Create a short cinematic video about a red sports car drifting at night. Keep the car red and use 9:16 format.';
const validPlan = {
  goal: 'Create the requested vertical drift video.',
  deliverable: { type: 'video', description: 'A short 9:16 cinematic drift video.' },
  steps: [
    { id: 'brief', action: 'Extract the visual and format requirements.', purpose: 'Lock the request before production.', inputs: ['user request'], outputs: ['production brief'], dependsOn: [], requiredCapabilities: ['text-planning'] },
    { id: 'shots', action: 'Plan distinct drift shots.', purpose: 'Create a coherent shot sequence.', inputs: ['production brief'], outputs: ['shot plan'], dependsOn: ['brief'], requiredCapabilities: ['storyboarding'] },
    { id: 'render', action: 'Generate and assemble the video.', purpose: 'Produce the requested deliverable.', inputs: ['shot plan'], outputs: ['video'], dependsOn: ['shots'], requiredCapabilities: ['video-generation', 'video-rendering'] }
  ],
  constraints: ['Keep the car red.', 'Use 9:16 format.'],
  requiredAssets: [],
  openQuestions: []
};

test('validates a provider-neutral plan and preserves the exact source request', () => {
  const result = validateUniversalTaskPlan(validPlan, request);
  assert.equal(result.ok, true);
  assert.equal(result.plan.sourceRequest, request);
  assert.equal(result.plan.steps.length, 3);
  assert.deepEqual(result.plan.steps[2].dependsOn, ['shots']);
  assert.equal(result.plan.schemaVersion, 1);
});

test('rejects missing steps, duplicate IDs, unknown dependencies, and dependency cycles', () => {
  assert.equal(validateUniversalTaskPlan({ ...validPlan, steps: [] }, request).reason, 'step-count-out-of-range');
  assert.equal(validateUniversalTaskPlan({ ...validPlan, steps: [validPlan.steps[0], validPlan.steps[0]] }, request).reason, 'invalid-or-duplicate-step-id');
  assert.equal(validateUniversalTaskPlan({ ...validPlan, steps: [{ ...validPlan.steps[0], dependsOn: ['missing'] }] }, request).reason, 'unknown-step-dependency');
  assert.equal(validateUniversalTaskPlan({ ...validPlan, steps: [
    { ...validPlan.steps[0], dependsOn: ['second'] },
    { ...validPlan.steps[1], id: 'second', dependsOn: ['brief'] }
  ] }, request).reason, 'cyclic-step-dependencies');
});

test('does not treat a malformed or non-object model response as a plan', () => {
  assert.equal(validateUniversalTaskPlan(null, request).reason, 'plan-is-not-an-object');
  assert.equal(validateUniversalTaskPlan({ ...validPlan, deliverable: null }, request).reason, 'goal-or-deliverable-missing');
});

test('builds a universal prompt without assuming a cartoon-only request', () => {
  const prompt = buildUniversalPlannerPrompt('Analyze a product demo and create subtitles.');
  assert.match(prompt, /Do not assume the request is a cartoon/);
  assert.match(prompt, /Analyze a product demo and create subtitles/);
});

test('accepts a valid model plan wrapped in a Markdown fence', async () => {
  const runtime = {
    status: { modelId: 'test-model', backend: 'wasm' },
    generate: async () => ({ text: 'Here is the plan:\n```json\n' + JSON.stringify(validPlan) + '\n```', modelId: 'test-model', backend: 'wasm' })
  };
  const result = await planUniversalTask({ runtime, request });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'planned');
  assert.equal(result.validation, 'structural-only');
  assert.equal(result.plan.sourceRequest, request);
  assert.equal(result.backend, 'wasm');
});

test('rejects malformed model output and reports inference failures without inventing a fallback plan', async () => {
  const malformed = await planUniversalTask({ runtime: { generate: async () => ({ text: 'not JSON' }) }, request });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.status, 'invalid-plan');
  const failed = await planUniversalTask({ runtime: { generate: async () => { throw new Error('device memory exhausted'); } }, request });
  assert.equal(failed.ok, false);
  assert.equal(failed.status, 'inference-failed');
  assert.equal(failed.reason, 'device memory exhausted');
});

test('honours cancellation before and after model inference', async () => {
  const controller = new AbortController();
  controller.abort();
  const before = await planUniversalTask({ runtime: { generate: async () => ({ text: '{}' }) }, request, signal: controller.signal });
  assert.equal(before.status, 'cancelled');
  const afterController = new AbortController();
  const after = await planUniversalTask({
    runtime: { generate: async () => { afterController.abort(); return { text: JSON.stringify(validPlan) }; } },
    request,
    signal: afterController.signal
  });
  assert.equal(after.status, 'cancelled');
});

test('rejects empty requests before calling a model provider', async () => {
  let called = false;
  const result = await planUniversalTask({ runtime: { generate: async () => { called = true; } }, request: ' ' });
  assert.equal(result.status, 'invalid-request');
  assert.equal(called, false);
});
