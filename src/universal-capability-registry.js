const clean = (value, max = 100) => String(value ?? '').trim().slice(0, max);
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);

function normalizeCapability(raw) {
  if (!isRecord(raw)) throw new TypeError('Capability adapter must be an object.');
  const id = clean(raw.id, 80);
  if (!/^[a-z][a-z0-9._-]*$/.test(id)) throw new TypeError('Capability id must be a lowercase identifier.');
  if (typeof raw.run !== 'function') throw new TypeError('Capability adapter must implement run(context).');
  const privacy = raw.privacy || 'local';
  if (!['local', 'remote'].includes(privacy)) throw new TypeError('Capability privacy must be local or remote.');
  return Object.freeze({
    id,
    name: clean(raw.name, 120) || id,
    privacy,
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
 *
 * Register real application adapters only. Remote adapters are blocked unless
 * explicit consent is supplied for the current registry instance. A single
 * registry-wide lease prevents two independent task executions from running
 * heavy model/media work at the same time on a mobile device.
 */
export function createUniversalCapabilityRegistry({ remoteConsent = false } = {}) {
  const adapters = new Map();
  let active = null;

  function assertAvailable(adapter, context) {
    if (adapter.requiresConsent && remoteConsent !== true) {
      const error = new Error('Explicit consent is required before using remote capability "' + adapter.id + '".');
      error.code = 'REMOTE_CONSENT_REQUIRED';
      throw error;
    }
    if (adapter.isAvailable(context) !== true) {
      const error = new Error('Capability "' + adapter.id + '" is not currently available.');
      error.code = 'CAPABILITY_UNAVAILABLE';
      throw error;
    }
  }

  return Object.freeze({
    register(raw) {
      const adapter = normalizeCapability(raw);
      if (adapters.has(adapter.id)) throw new Error('Capability "' + adapter.id + '" is already registered.');
      adapters.set(adapter.id, adapter);
      return { id: adapter.id, name: adapter.name, privacy: adapter.privacy, requiresConsent: adapter.requiresConsent };
    },

    has(id) {
      return adapters.has(clean(id, 80));
    },

    list() {
      return [...adapters.values()].map(adapter => ({
        id: adapter.id,
        name: adapter.name,
        privacy: adapter.privacy,
        requiresConsent: adapter.requiresConsent
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

          const lease = { id: adapter.id, taskId };
          active = lease;
          try {
            if (context?.signal?.aborted) throw abortError();
            const result = await adapter.run({
              ...context,
              capabilityId: adapter.id,
              taskId,
              privacy: adapter.privacy
            });
            if (context?.signal?.aborted) throw abortError();
            return result;
          } finally {
            if (active === lease) active = null;
          }
        };
      }
      return Object.freeze(handlers);
    }
  });
}

/**
 * Validate and bind a capability registry to one already-validated plan.
 * A step requiring exactly one registered capability is executable. Steps
 * requiring multiple capabilities remain blocked until the app provides an
 * explicit composite step handler; the registry never guesses how to combine
 * different media operations.
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
    bindings.push({ stepId: clean(step.id, 48), status: 'ready', capabilityId });
  }
  return { ok: true, bindings, readyCount: bindings.filter(item => item.status === 'ready').length };
}
