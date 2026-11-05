import test from 'node:test';
import assert from 'node:assert/strict';
import { createUniversalCapabilityRegistry, bindUniversalPlanCapabilities } from '../src/universal-capability-registry.js';

test('registers adapters and exposes safe metadata', () => {
  const registry = createUniversalCapabilityRegistry();
  registry.register({ id: 'storyboard', name: 'Storyboard', run: async () => ({ scenes: 5 }) });
  assert.equal(registry.has('storyboard'), true);
  assert.deepEqual(registry.list(), [{ id: 'storyboard', name: 'Storyboard', privacy: 'local', requiresConsent: false, available: true }]);
  assert.throws(() => registry.register({ id: 'storyboard', run: async () => null }), /already registered/);
});

test('rejects malformed adapters and unsafe identifiers', () => {
  const registry = createUniversalCapabilityRegistry();
  assert.throws(() => registry.register({ id: 'Bad ID', run: async () => null }), /lowercase identifier/);
  assert.throws(() => registry.register({ id: 'video' }), /implement run/);
  assert.throws(() => registry.register({ id: 'video', privacy: 'unknown', run: async () => null }), /privacy/);
});

test('requires explicit consent before remote capability execution', async () => {
  let calls = 0;
  const registry = createUniversalCapabilityRegistry();
  registry.register({ id: 'remote-video', privacy: 'remote', run: async () => { calls += 1; return 'video'; } });
  await assert.rejects(registry.createHandlers()['remote-video']({}), error => error.code === 'REMOTE_CONSENT_REQUIRED');
  assert.equal(calls, 0);
  const consented = createUniversalCapabilityRegistry({ remoteConsent: true });
  consented.register({ id: 'remote-video', privacy: 'remote', run: async () => { calls += 1; return 'video'; } });
  assert.equal(await consented.createHandlers()['remote-video']({}), 'video');
  assert.equal(calls, 1);
});

test('blocks unavailable capabilities before invoking adapters', async () => {
  let calls = 0;
  const registry = createUniversalCapabilityRegistry();
  registry.register({ id: 'local-render', isAvailable: () => false, run: async () => { calls += 1; } });
  await assert.rejects(registry.createHandlers()['local-render']({}), error => error.code === 'CAPABILITY_UNAVAILABLE');
  assert.equal(calls, 0);
});

test('prevents concurrent heavy tasks across independent handler calls and releases lease', async () => {
  const registry = createUniversalCapabilityRegistry();
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  registry.register({ id: 'local-video', run: async () => { await wait; return 'done'; } });
  registry.register({ id: 'local-voice', run: async () => 'voice' });
  const handlers = registry.createHandlers();
  const first = handlers['local-video']({ taskId: 'first' });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(registry.status, { busy: true, activeCapability: 'local-video' });
  await assert.rejects(handlers['local-voice']({ taskId: 'second' }), error => error.code === 'CAPABILITY_RUNTIME_BUSY');
  release();
  assert.equal(await first, 'done');
  assert.deepEqual(registry.status, { busy: false, activeCapability: null });
  assert.equal(await handlers['local-voice']({}), 'voice');
});

test('honours cancellation before and after a non-interruptible adapter operation', async () => {
  const registry = createUniversalCapabilityRegistry();
  let calls = 0;
  registry.register({ id: 'local-model', run: async () => { calls += 1; return 'stale'; } });
  const handler = registry.createHandlers()['local-model'];
  const before = new AbortController();
  before.abort();
  await assert.rejects(handler({ signal: before.signal }), error => error.name === 'AbortError');
  assert.equal(calls, 0);

  const after = new AbortController();
  const registry2 = createUniversalCapabilityRegistry();
  registry2.register({ id: 'local-model', run: async ({ signal }) => { signal.addEventListener('abort', () => {}); after.abort(); return 'stale'; } });
  await assert.rejects(registry2.createHandlers()['local-model']({ signal: after.signal }), error => error.name === 'AbortError');
  assert.deepEqual(registry2.status, { busy: false, activeCapability: null });
});

test('binds only single registered capabilities and blocks ambiguous steps', () => {
  const registry = createUniversalCapabilityRegistry();
  registry.register({ id: 'local-storyboard', run: async () => null });
  const plan = { steps: [
    { id: 'a', requiredCapabilities: ['local-storyboard'] },
    { id: 'b', requiredCapabilities: ['remote-video'] },
    { id: 'c', requiredCapabilities: ['local-storyboard', 'local-render'] },
    { id: 'd', requiredCapabilities: [] }
  ] };
  const result = bindUniversalPlanCapabilities(plan, registry);
  assert.equal(result.ok, true);
  assert.equal(result.readyCount, 1);
  assert.deepEqual(result.bindings.map(item => item.status), ['ready', 'blocked', 'blocked', 'blocked']);
  assert.equal(result.bindings[1].reason, 'capability-not-registered');
  assert.equal(result.bindings[2].reason, 'composite-step-handler-required');
  assert.equal(result.bindings[3].reason, 'step-has-no-required-capability');
});

test('rejects invalid plan or registry input', () => {
  assert.deepEqual(bindUniversalPlanCapabilities(null, null), { ok: false, reason: 'invalid-plan-or-registry' });
});


test('reports dynamic availability and blocks unavailable capabilities during plan binding', () => {
  let ready = false;
  const registry = createUniversalCapabilityRegistry();
  registry.register({
    id: 'local-voice',
    isAvailable: ({ plan, step } = {}) => ready && plan?.sourceRequest === 'Add dialogue' && step?.id === 'voice',
    run: async () => 'voice'
  });
  const plan = { sourceRequest: 'Add dialogue', steps: [{ id: 'voice', requiredCapabilities: ['local-voice'] }] };
  assert.equal(registry.list()[0].available, false);
  assert.equal(bindUniversalPlanCapabilities(plan, registry).bindings[0].reason, 'capability-unavailable');
  ready = true;
  assert.equal(registry.list({ plan, step: plan.steps[0] }).length, 1);
  assert.equal(registry.list({ plan, step: plan.steps[0] })[0].available, true);
  assert.equal(bindUniversalPlanCapabilities(plan, registry).bindings[0].status, 'ready');
});

test('reports remote capability unavailable until explicit consent is configured', () => {
  const registry = createUniversalCapabilityRegistry();
  registry.register({ id: 'remote-video', privacy: 'remote', run: async () => 'video' });
  assert.equal(registry.isAvailable('remote-video'), false);
  assert.equal(registry.list()[0].available, false);
  const consented = createUniversalCapabilityRegistry({ remoteConsent: true });
  consented.register({ id: 'remote-video', privacy: 'remote', run: async () => 'video' });
  assert.equal(consented.isAvailable('remote-video'), true);
});


test('allows consent to be granted and revoked at runtime', async () => {
  const registry = createUniversalCapabilityRegistry();
  let calls = 0;
  registry.register({ id: 'remote-video', privacy: 'remote', run: async () => { calls += 1; return 'ok'; } });
  assert.equal(registry.isAvailable('remote-video'), false);
  registry.setRemoteConsent(true);
  assert.equal(registry.isAvailable('remote-video'), true);
  assert.equal(await registry.createHandlers()['remote-video']({}), 'ok');
  registry.setRemoteConsent(false);
  assert.equal(registry.isAvailable('remote-video'), false);
  await assert.rejects(registry.createHandlers()['remote-video']({}), error => error.code === 'REMOTE_CONSENT_REQUIRED');
  assert.equal(calls, 1);
});

test('scoped remote consent is independent from the global remote consent switch', () => {
  const registry = createUniversalCapabilityRegistry();
  registry.register({ id: 'horde-image', privacy: 'remote', consentKey: 'ai-horde-image', run: async () => 'image' });
  assert.equal(registry.isAvailable('horde-image'), false);
  registry.setRemoteConsent(true);
  assert.equal(registry.isAvailable('horde-image'), false);
  registry.setConsent('ai-horde-image', true);
  assert.equal(registry.isAvailable('horde-image'), true);
  registry.setRemoteConsent(false);
  assert.equal(registry.isAvailable('horde-image'), true);
  registry.setConsent('ai-horde-image', false);
  assert.equal(registry.isAvailable('horde-image'), false);
});

test('revoking one scoped consent aborts only the matching active remote capability', async () => {
  const registry = createUniversalCapabilityRegistry({ remoteConsent: true });
  let observedAbort = false;
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  registry.register({
    id: 'horde-image', privacy: 'remote', consentKey: 'ai-horde-image',
    run: async ({ signal }) => {
      signal.addEventListener('abort', () => { observedAbort = true; }, { once: true });
      started();
      await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
      return 'stale';
    }
  });
  registry.register({ id: 'hf-video', privacy: 'remote', run: async () => 'video' });
  const running = registry.createHandlers()['horde-image']({});
  await ready;
  registry.setConsent('ai-horde-image', false);
  await assert.rejects(running, error => error.name === 'AbortError');
  assert.equal(observedAbort, true);
  assert.equal(registry.isAvailable('hf-video'), true);
  assert.deepEqual(registry.status, { busy: false, activeCapability: null });
});

test('revoking remote consent aborts an active remote operation', async () => {
  const registry = createUniversalCapabilityRegistry({ remoteConsent: true });
  let observedAbort = false;
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  registry.register({
    id: 'remote-video',
    privacy: 'remote',
    run: async ({ signal }) => {
      signal.addEventListener('abort', () => { observedAbort = true; }, { once: true });
      started();
      await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
      return 'stale';
    }
  });
  const running = registry.createHandlers()['remote-video']({});
  await ready;
  registry.setRemoteConsent(false);
  await assert.rejects(running, error => error.name === 'AbortError');
  assert.equal(observedAbort, true);
  assert.deepEqual(registry.status, { busy: false, activeCapability: null });
});
