import test from 'node:test';
import assert from 'node:assert/strict';
import { executeUniversalTaskPlan } from '../src/universal-task-executor.js';

const plan = {
  schemaVersion: 1,
  sourceRequest: 'Create a short video and export it.',
  goal: 'Create and export a short video.',
  deliverable: { type: 'video', description: 'A rendered short video.' },
  steps: [
    { id: 'brief', action: 'Prepare brief', purpose: 'Lock requirements', inputs: [], outputs: ['brief'], dependsOn: [], requiredCapabilities: ['briefing'] },
    { id: 'render', action: 'Render video', purpose: 'Create video', inputs: ['brief'], outputs: ['video'], dependsOn: ['brief'], requiredCapabilities: ['video-rendering'] },
    { id: 'export', action: 'Export video', purpose: 'Deliver file', inputs: ['video'], outputs: ['file'], dependsOn: ['render'], requiredCapabilities: ['export'] }
  ],
  constraints: [],
  requiredAssets: [],
  openQuestions: []
};

test('executes steps sequentially and reports progress and durable checkpoints', async () => {
  const order = [];
  const progress = [];
  const checkpoints = [];
  const handlers = {
    briefing: async ({ step, reportProgress }) => { order.push(step.id); reportProgress('brief ready'); return { brief: true }; },
    'video-rendering': async ({ step, results }) => { assert.equal(results.brief.brief, true); order.push(step.id); return { video: true }; },
    export: async ({ step, results }) => { assert.equal(results.render.video, true); order.push(step.id); return { file: 'film.webm' }; }
  };
  const result = await executeUniversalTaskPlan({
    plan, handlers,
    onProgress: event => progress.push(event),
    onCheckpoint: checkpoint => checkpoints.push(checkpoint)
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'completed');
  assert.deepEqual(order, ['brief', 'render', 'export']);
  assert.equal(result.results.export.file, 'film.webm');
  assert.equal(checkpoints.length, 3);
  assert.equal(progress.at(-1).percent, 100);
});

test('blocks a step when its handler is unavailable and does not run later steps', async () => {
  let laterRan = false;
  const result = await executeUniversalTaskPlan({
    plan,
    handlers: { briefing: async () => 'brief' }
  });
  assert.equal(result.status, 'blocked');
  assert.equal(result.stepId, 'render');
  assert.equal(result.reason, 'step-handler-not-found');
  assert.equal(laterRan, false);
});

test('supports explicit step handlers for steps requiring multiple capabilities', async () => {
  const multi = {
    ...plan,
    steps: [{ ...plan.steps[0], requiredCapabilities: ['image-generation', 'quality-audit'] }]
  };
  const result = await executeUniversalTaskPlan({
    plan: multi,
    handlers: { brief: { capabilities: ['image-generation', 'quality-audit'], run: async () => 'asset' } }
  });
  assert.equal(result.status, 'completed');
  assert.equal(result.results.brief, 'asset');
});

test('resumes from a checkpoint without rerunning completed work', async () => {
  let briefRuns = 0;
  const checkpoint = { completedStepIds: ['brief'], results: { brief: { ready: true } } };
  const result = await executeUniversalTaskPlan({
    plan,
    checkpoint,
    handlers: {
      briefing: async () => { briefRuns += 1; return 'unexpected'; },
      'video-rendering': async () => ({ video: true }),
      export: async () => ({ file: 'resumed.webm' })
    }
  });
  assert.equal(result.status, 'completed');
  assert.equal(briefRuns, 0);
  assert.equal(result.results.export.file, 'resumed.webm');
});

test('rejects checkpoints that violate dependency order', async () => {
  const result = await executeUniversalTaskPlan({
    plan,
    checkpoint: { completedStepIds: ['export'], results: {} },
    handlers: {}
  });
  assert.equal(result.status, 'invalid-checkpoint');
  assert.equal(result.reason, 'checkpoint-breaks-dependency-order');
});

test('cancellation prevents starting the next step and returns a resumable checkpoint', async () => {
  const controller = new AbortController();
  let secondRan = false;
  const result = await executeUniversalTaskPlan({
    plan,
    signal: controller.signal,
    handlers: {
      briefing: async () => { controller.abort(); return 'brief'; },
      'video-rendering': async () => { secondRan = true; },
      export: async () => 'file'
    }
  });
  assert.equal(result.status, 'cancelled');
  assert.equal(secondRan, false);
  assert.deepEqual(result.checkpoint.completedStepIds, []);
});

test('does not continue after checkpoint persistence fails', async () => {
  let renderRan = false;
  const result = await executeUniversalTaskPlan({
    plan,
    handlers: { briefing: async () => 'brief', 'video-rendering': async () => { renderRan = true; }, export: async () => 'file' },
    onCheckpoint: async () => { throw new Error('storage unavailable'); }
  });
  assert.equal(result.status, 'checkpoint-failed');
  assert.equal(result.reason, 'storage unavailable');
  assert.equal(renderRan, false);
});

test('does not invoke handlers for a malformed plan', async () => {
  let called = false;
  const result = await executeUniversalTaskPlan({ plan: { ...plan, steps: [] }, handlers: { briefing: async () => { called = true; } } });
  assert.equal(result.status, 'invalid-plan');
  assert.equal(called, false);
});
