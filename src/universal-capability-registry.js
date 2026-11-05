const clean = (value, max = 100) => String(value ?? '').trim().slice(0, max);
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);

function normalizeCapability(raw) {
  if (!isRecord(raw)) throw new TypeError('Capability adapter must be an object.');
  const id = clean(raw.id, 80);
  if (!/^[a-z][a-z0-9._-]*$/.test(id)) throw new TypeError('Capability id must be a lowercase identifier.');
  if (typeof raw.run !== 'function') throw new TypeError('Capability adapter must implement run(context).');
  const privacy = raw.privacy || 'local';
  if (!['local', 'remote'].includes(privacy)) throw new TypeError('Capability privacy must be local or remote.');
  const consentKey = clean(raw.consentKey, 80) || null;
  if (consentKey && privacy !== 'remote') throw new TypeError('Scoped consent keys are only valid for remote capabilities.');
  return Object.freeze({
    id,
    name: clean(raw.name, 120) || id,
    privacy,
    consentKey,
    requiresConsent: raw.requiresConsent === true || privacy === 'remote',
    isAvailable: typeof raw.isAvailable === 'function' ? raw.isAvailable : () => raw.available !== false,
    run: raw.run
  });
}

function abortError() {
  const error = new Error('Universal task capability was cancelled.');
  error.name = 'AbortError';
  return error;
}

/**
 * A shared, fail-fast capability registry for DRAVEX task execution.
 * Only explicitly injected application adapters can run. Remote adapters are
 * blocked without explicit consent, and one registry-wide lease prevents
 * concurrent heavy media/model tasks on mobile devices.
 */
export function createUniversalCapabilityRegistry({ remoteConsent = false } = {}) {
  const adapters = new Map();
  let active = null;
  let consentGranted = remoteConsent === true;
  const scopedConsent = new Map();

  function hasConsent(adapter) {
    if (!adapter.requiresConsent) return true;
    return adapter.consentKey ? scopedConsent.get(adapter.consentKey) === true : consentGranted === true;
  }

  function isAvailable(adapter, context) {
    if (!hasConsent(adapter)) return false;
    try { return adapter.isAvailable(context) === true; }
    catch { return false; }
  }

  function assertAvailable(adapter, context) {
    if (!hasConsent(adapter)) {
      const error = new Error('Explicit consent is required before using remote capability "' + adapter.id + '".');
      error.code = 'REMOTE_CONSENT_REQUIRED';
      throw error;
    }
    if (!isAvailable(adapter, context)) {
      const error = new Error('Capability "' + adapter.id + '" is not currently available.');
      error.code = 'CAPABILITY_UNAVAILABLE';
      throw error;
    }
  }

  return Object.freeze({
    setRemoteConsent(granted) {
      consentGranted = granted === true;
      if (!consentGranted && active?.adapter.requiresConsent && !active.adapter.consentKey) active.controller.abort();
      return consentGranted;
    },
    setConsent(key, granted) {
      const consentKey = clean(key, 80);
      if (!consentKey) throw new TypeError('A scoped consent key is required.');
      scopedConsent.set(consentKey, granted === true);
      if (granted !== true && active?.adapter.consentKey === consentKey) active.controller.abort();
      return scopedConsent.get(consentKey);
    },
    hasConsent(key) {
      const consentKey = clean(key, 80);
      return consentKey ? scopedConsent.get(consentKey) === true : consentGranted === true;
    },
    get remoteConsent() { return consentGranted; },
    register(raw) {
      const adapter = normalizeCapability(raw);
      if (adapters.has(adapter.id)) throw new Error('Capability "' + adapter.id + '" is already registered.');
      adapters.set(adapter.id, adapter);
      return { id: adapter.id, name: adapter.name, privacy: adapter.privacy, consentKey: adapter.consentKey, requiresConsent: adapter.requiresConsent };
    },
    has(id) {
      return adapters.has(clean(id, 80));
    },
    isAvailable(id, context) {
      const adapter = adapters.get(clean(id, 80));
      return Boolean(adapter && isAvailable(adapter, context));
    },
    list(context) {
      return [...adapters.values()].map(adapter => ({
        id: adapter.id,
        name: adapter.name,
        privacy: adapter.privacy,
        requiresConsent: adapter.requiresConsent,
        consentKey: adapter.consentKey,
        available: isAvailable(adapter, context)
      }));
    },
    get status() {
      return { busy: Boolean(active), activeCapability: active?.id || null };
    },
    createHandlers() {
      const handlers = {};
      for (const adapter of adapters.values()) {
        handlers[adapter.id] = async context => {
          const taskId = clean(context?.taskId, 100) || 'universal-task';
          if (context?.signal?.aborted) throw abortError();
          assertAvailable(adapter, context);
          if (active) {
            const error = new Error('Another DRAVEX capability is already running: "' + active.id + '".');
            error.code = 'CAPABILITY_RUNTIME_BUSY';
            throw error;
          }
          const controller = new AbortController();
          const externalSignal = context?.signal;
          const relayAbort = () => controller.abort();
          if (externalSignal?.aborted) controller.abort();
          else externalSignal?.addEventListener('abort', relayAbort, { once: true });
          const lease = { id: adapter.id, taskId, adapter, controller };
          active = lease;
          try {
            if (controller.signal.aborted) throw abortError();
            const result = await adapter.run({
              ...context,
              signal: controller.signal,
              capabilityId: adapter.id,
              taskId,
              privacy: adapter.privacy
            });
            if (controller.signal.aborted) throw abortError();
            return result;
          } finally {
            externalSignal?.removeEventListener('abort', relayAbort);
            if (active === lease) active = null;
          }
        };
      }
      return Object.freeze(handlers);
    }
  });
}

/**
 * Bind plan steps only when their single required capability is registered.
 * Composite steps require an explicit app-owned handler; this module never
 * guesses how to combine unrelated media operations.
 */
export function bindUniversalPlanCapabilities(plan, registry) {
  if (!isRecord(plan) || !Array.isArray(plan.steps) || !registry || typeof registry.has !== 'function') {
    return { ok: false, reason: 'invalid-plan-or-registry' };
  }
  const bindings = [];
  for (const step of plan.steps) {
    const required = Array.isArray(step.requiredCapabilities) ? step.requiredCapabilities : [];
    if (required.length !== 1) {
      bindings.push({
        stepId: clean(step.id, 48),
        status: 'blocked',
        reason: required.length === 0 ? 'step-has-no-required-capability' : 'composite-step-handler-required',
        capabilities: required
      });
      continue;
    }
    const capabilityId = clean(required[0], 80);
    if (!registry.has(capabilityId)) {
      bindings.push({ stepId: clean(step.id, 48), status: 'blocked', reason: 'capability-not-registered', capabilities: [capabilityId] });
      continue;
    }
    if (typeof registry.isAvailable === 'function' && !registry.isAvailable(capabilityId, { plan, step })) {
      bindings.push({ stepId: clean(step.id, 48), status: 'blocked', reason: 'capability-unavailable', capabilities: [capabilityId] });
      continue;
    }
    bindings.push({ stepId: clean(step.id, 48), status: 'ready', capabilityId });
  }
  return { ok: true, bindings, readyCount: bindings.filter(item => item.status === 'ready').length };
}
