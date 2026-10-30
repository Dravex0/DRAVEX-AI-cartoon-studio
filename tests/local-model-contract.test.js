import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateLocalModelManifest,
  assessLocalModelFit,
  createLocalModelAdapter
} from '../src/local-model-contract.js';

const manifest = {
  id: 'dravex-story-small',
  version: '1.0.0',
  backend: 'wasm',
  localOnly: true,
  license: 'Apache-2.0',
  tasks: ['story-planning', 'scene-directing'],
  modelSizeBytes: 800_000_000,
  minMemoryGB: 2,
  files: [{ path: 'model.onnx', sizeBytes: 800_000_000, sha256: 'a'.repeat(64) }]
};

test('validates a declared local model manifest and rejects cloud-only packages', () => {
  assert.equal(validateLocalModelManifest(manifest).valid, true);
  const invalid = validateLocalModelManifest({ ...manifest, localOnly: false });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.issues.some(issue => issue.code === 'model-not-declared-local-only'));
});

test('assesses device fit without claiming that inference is guaranteed', () => {
  const fit = assessLocalModelFit(manifest, {
    wasmAvailable: true,
    deviceMemoryGB: 4,
    storage: { availableBytes: 2_000_000_000 }
  });
  assert.equal(fit.status, 'eligible-to-test');
  assert.equal(fit.canAttempt, true);
  assert.match(fit.warning, /advisory/);
});

test('blocks a model when required memory or storage clearly exceeds available estimates', () => {
  const fit = assessLocalModelFit(manifest, {
    wasmAvailable: true,
    deviceMemoryGB: 1,
    storage: { availableBytes: 100_000_000 }
  });
  assert.equal(fit.status, 'not-recommended');
  assert.equal(fit.canAttempt, false);
  assert.ok(fit.issues.some(issue => issue.code === 'insufficient-device-memory'));
  assert.ok(fit.issues.some(issue => issue.code === 'insufficient-storage'));
});

test('does not treat unknown hardware estimates as a guaranteed fit', () => {
  const fit = assessLocalModelFit(manifest, { wasmAvailable: true });
  assert.equal(fit.status, 'unknown');
  assert.equal(fit.canAttempt, true);
});

test('runs an injected local inference runner and parses structured JSON output', async () => {
  const adapter = createLocalModelAdapter({
    manifest,
    runner: async request => {
      assert.equal(request.task, 'story-planning');
      assert.equal(request.outputFormat, 'json');
      return '{"scenes":[{"title":"Opening"}]}';
    }
  });
  const result = await adapter.generate({ task: 'story-planning', prompt: 'Create a short story', outputFormat: 'json' });
  assert.equal(result.local, true);
  assert.equal(result.data.scenes[0].title, 'Opening');
});

test('rejects unsupported tasks, empty prompts, invalid JSON, and missing runners', async () => {
  const adapter = createLocalModelAdapter({ manifest, runner: async () => 'not-json' });
  await assert.rejects(adapter.generate({ task: 'image-generation', prompt: 'hello' }), /does not support/);
  await assert.rejects(adapter.generate({ task: 'story-planning', prompt: '' }), /prompt is required/);
  await assert.rejects(adapter.generate({ task: 'story-planning', prompt: 'hello', outputFormat: 'json' }), /valid JSON/);
  assert.throws(() => createLocalModelAdapter({ manifest }), /runner function/);
});

test('honors cancellation before inference starts', async () => {
  const controller = new AbortController();
  controller.abort();
  const adapter = createLocalModelAdapter({ manifest, runner: async () => 'never' });
  await assert.rejects(adapter.generate({ task: 'story-planning', prompt: 'hello' }, { signal: controller.signal }), { name: 'AbortError' });
});

test('rejects path traversal and missing model file checksums', () => {
  const unsafe = validateLocalModelManifest({
    ...manifest,
    files: [{ path: '../private/model.onnx', sizeBytes: 800_000_000, sha256: '' }]
  });
  assert.equal(unsafe.valid, false);
  assert.ok(unsafe.issues.some(issue => issue.code === 'invalid-model-files'));
  assert.ok(unsafe.issues.some(issue => issue.code === 'invalid-file-checksum'));
});

test('does not assume WASM support when browser capability is unknown', () => {
  const fit = assessLocalModelFit(manifest, {
    deviceMemoryGB: 4,
    storage: { availableBytes: 2_000_000_000 }
  });
  assert.equal(fit.status, 'unknown');
  assert.equal(fit.canAttempt, true);
});
