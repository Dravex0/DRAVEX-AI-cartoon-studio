/**
 * Strict structured scene-state contract.
 *
 * This module is intentionally additive: the existing scene-model.js remains
 * the legacy storyboard adapter until downstream consumers are migrated.
 * Do not silently translate legacy state-change fields into this contract.
 */

const CHARACTER_FIELDS = Object.freeze(["location", "position", "pose", "clothing"]);
const OBJECT_FIELDS = Object.freeze(["location", "owner", "state"]);
const ALLOWED = Object.freeze({
  scene: new Set(["location", "time", "weather"]),
  character: new Set(CHARACTER_FIELDS),
  object: new Set(OBJECT_FIELDS)
});
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const MAX_ENTITIES = 500;
const MAX_SCENES = 1000;
const MAX_STATE_CHANGES = 1000;
const MAX_CLONE_NODES = 10000;
const MAX_CLONE_DEPTH = 40;

const isRecord = value => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
};

function safeRead(object, key) {
  try {
    return { ok: true, value: object?.[key] };
  } catch {
    return { ok: false };
  }
}

function asStringOrNull(value, max = 500) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return String(value).slice(0, max);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function hasOwn(object, key) {
  try {
    return Object.prototype.hasOwnProperty.call(object, key);
  } catch {
    return false;
  }
}

export function normalizeCharacterState(raw) {
  if (!isRecord(raw)) return null;
  const result = {};
  for (const field of CHARACTER_FIELDS) {
    const read = safeRead(raw, field);
    if (!read.ok) return null;
    result[field] = asStringOrNull(read.value);
  }
  return result;
}

export function normalizeObjectState(raw) {
  if (!isRecord(raw)) return null;
  const result = {};
  for (const field of OBJECT_FIELDS) {
    const read = safeRead(raw, field);
    if (!read.ok) return null;
    result[field] = asStringOrNull(read.value);
  }
  return result;
}

function normalizeEntityMap(raw, normalizeEntry) {
  if (raw === null || raw === undefined) return { ok: true, value: {} };
  if (!isRecord(raw)) return { ok: false };

  let keys;
  try {
    keys = Object.keys(raw);
  } catch {
    return { ok: false };
  }
  if (keys.length > MAX_ENTITIES) return { ok: false };

  const result = {};
  const seen = new Set();
  for (const rawKey of keys) {
    const id = asStringOrNull(rawKey, 120);
    if (!id || DANGEROUS_KEYS.has(id) || seen.has(id)) return { ok: false };
    seen.add(id);

    const read = safeRead(raw, rawKey);
    if (!read.ok) return { ok: false };
    const normalized = read.value == null ? null : normalizeEntry(read.value);
    if (read.value != null && normalized === null) return { ok: false };

    // defineProperty avoids the legacy __proto__ setter even if the key policy changes.
    Object.defineProperty(result, id, {
      value: normalized, enumerable: true, configurable: true, writable: true
    });
  }
  return { ok: true, value: result };
}

export function normalizeState(raw) {
  if (!isRecord(raw)) return null;

  const location = safeRead(raw, "location");
  const time = safeRead(raw, "time");
  const weather = safeRead(raw, "weather");
  const charactersRead = safeRead(raw, "characters");
  const objectsRead = safeRead(raw, "objects");
  if (!location.ok || !time.ok || !weather.ok || !charactersRead.ok || !objectsRead.ok) return null;

  const characters = normalizeEntityMap(charactersRead.value, normalizeCharacterState);
  const objects = normalizeEntityMap(objectsRead.value, normalizeObjectState);
  if (!characters.ok || !objects.ok) return null;

  return {
    location: asStringOrNull(location.value),
    time: asStringOrNull(time.value),
    weather: asStringOrNull(weather.value),
    characters: characters.value,
    objects: objects.value
  };
}

export function emptyState() {
  return { location: null, time: null, weather: null, characters: {}, objects: {} };
}

export function normalizeStateChange(raw, options = {}) {
  if (!isRecord(raw)) return { ok: false };

  const entityRead = safeRead(raw, "entity");
  const propertyRead = safeRead(raw, "property");
  const valueRead = safeRead(raw, "value");
  const previousRead = safeRead(raw, "previousValue");
  const actorRead = safeRead(raw, "actorId");
  const evidenceRead = safeRead(raw, "evidence");
  if (!entityRead.ok || !propertyRead.ok || !valueRead.ok ||
      !previousRead.ok || !actorRead.ok || !evidenceRead.ok) return { ok: false };

  const entity = asStringOrNull(entityRead.value, 120);
  const property = asStringOrNull(propertyRead.value, 40);
  const value = asStringOrNull(valueRead.value, 500);
  if (!entity || !property || value === null) return { ok: false };

  let kind;
  if (typeof options.kindResolver === "function") {
    try {
      kind = options.kindResolver(entity);
    } catch {
      return { ok: false };
    }
    if (!kind || !ALLOWED[kind]?.has(property)) return { ok: false };
  } else {
    const allowedSomewhere = Object.values(ALLOWED).some(properties => properties.has(property));
    if (!allowedSomewhere) return { ok: false };
  }

  return {
    ok: true,
    value: {
      entity,
      property,
      previousValue: asStringOrNull(previousRead.value),
      value,
      actorId: asStringOrNull(actorRead.value, 120),
      evidence: asStringOrNull(evidenceRead.value, 1000)
    }
  };
}

export function normalizeStateChanges(raw, options = {}) {
  if (raw === null || raw === undefined) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false };

  let length;
  try {
    length = raw.length;
  } catch {
    return { ok: false };
  }
  if (length > MAX_STATE_CHANGES) return { ok: false };

  const result = [];
  for (let index = 0; index < length; index += 1) {
    const read = safeRead(raw, index);
    if (!read.ok) return { ok: false };
    const normalized = normalizeStateChange(read.value, options);
    if (!normalized.ok) return { ok: false };
    result.push(normalized.value);
  }
  return { ok: true, value: result };
}

function collectIdsFromMap(state, key, target) {
  const stateRead = safeRead(state, key);
  if (!stateRead.ok || stateRead.value == null) return true;
  if (!isRecord(stateRead.value)) return false;

  let keys;
  try {
    keys = Object.keys(stateRead.value);
  } catch {
    return false;
  }
  if (keys.length > MAX_ENTITIES) return false;
  for (const rawId of keys) {
    const id = asStringOrNull(rawId, 120);
    if (!id || DANGEROUS_KEYS.has(id)) return false;
    target.add(id);
  }
  return true;
}

function buildKindContext(scenes) {
  const characterIds = new Set();
  const objectIds = new Set();

  for (let index = 0; index < scenes.length; index += 1) {
    const sceneRead = safeRead(scenes, index);
    if (!sceneRead.ok || !isRecord(sceneRead.value)) return { ok: false };
    const scene = sceneRead.value;

    const castRead = safeRead(scene, "characters");
    if (!castRead.ok) return { ok: false };
    if (castRead.value != null) {
      if (!Array.isArray(castRead.value)) return { ok: false };
      for (let castIndex = 0; castIndex < castRead.value.length; castIndex += 1) {
        const characterRead = safeRead(castRead.value, castIndex);
        if (!characterRead.ok) return { ok: false };
        const id = asStringOrNull(characterRead.value, 120);
        if (!id || DANGEROUS_KEYS.has(id)) return { ok: false };
        characterIds.add(id);
      }
    }

    for (const stateKey of ["startState", "endState"]) {
      const stateRead = safeRead(scene, stateKey);
      if (!stateRead.ok) return { ok: false };
      if (stateRead.value == null || typeof stateRead.value === "string") continue;
      if (!isRecord(stateRead.value)) return { ok: false };

      const normalizedState = normalizeState(stateRead.value);
      if (!normalizedState) return { ok: false };
      for (const id of Object.keys(normalizedState.characters)) characterIds.add(id);
      for (const id of Object.keys(normalizedState.objects)) objectIds.add(id);
    }
  }

  const conflictingIds = new Set();
  for (const id of characterIds) if (objectIds.has(id)) conflictingIds.add(id);

  const kindResolver = entity => {
    if (entity === "scene") return "scene";
    if (conflictingIds.has(entity)) return null;
    if (characterIds.has(entity)) return "character";
    if (objectIds.has(entity)) return "object";
    return null;
  };
  return { ok: true, kindResolver, conflictingIds };
}

/**
 * Clone only JSON-safe arrays and plain objects. Rejects cycles, accessors,
 * sparse arrays, non-finite numbers, special objects, and resource-limit abuse.
 */
function cloneLocked(input) {
  const ancestors = new Set();
  let nodes = 0;

  function visit(value, depth) {
    nodes += 1;
    if (nodes > MAX_CLONE_NODES || depth > MAX_CLONE_DEPTH) throw new Error("clone-limit");
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error("non-finite");
      return value;
    }
    if (typeof value !== "object") throw new Error("non-json-value");
    if (ancestors.has(value)) throw new Error("circular");
    ancestors.add(value);

    let result;
    if (Array.isArray(value)) {
      const length = value.length;
      if (length > MAX_CLONE_NODES) throw new Error("array-limit");
      result = [];
      for (let index = 0; index < length; index += 1) {
        if (!hasOwn(value, index)) throw new Error("sparse-array");
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !("value" in descriptor)) throw new Error("array-accessor");
        result.push(visit(descriptor.value, depth + 1));
      }
    } else {
      if (!isRecord(value)) throw new Error("non-plain-object");
      let keys;
      try { keys = Object.keys(value); } catch { throw new Error("unreadable-keys"); }
      result = {};
      for (const key of keys) {
        if (DANGEROUS_KEYS.has(key)) throw new Error("dangerous-key");
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !("value" in descriptor)) throw new Error("object-accessor");
        Object.defineProperty(result, key, {
          value: visit(descriptor.value, depth + 1),
          enumerable: true, configurable: true, writable: true
        });
      }
    }
    ancestors.delete(value);
    return result;
  }

  try {
    return { ok: true, value: visit(input, 0) };
  } catch {
    return { ok: false };
  }
}

function normalizeOptionalState(raw) {
  if (raw === null || raw === undefined || typeof raw === "string") {
    return { ok: true, value: null };
  }
  const value = normalizeState(raw);
  return value ? { ok: true, value } : { ok: false };
}

function hasConflictingIdInState(scene, conflictingIds) {
  for (const stateKey of ["startState", "endState"]) {
    const state = scene[stateKey];
    if (!state) continue;
    for (const id of Object.keys(state.characters)) if (conflictingIds.has(id)) return true;
    for (const id of Object.keys(state.objects)) if (conflictingIds.has(id)) return true;
  }
  return false;
}

export function normalizeScene(raw, options = {}) {
  try {
    if (!isRecord(raw)) return null;

    const idRead = safeRead(raw, "id");
    if (!idRead.ok) return null;
    const id = asStringOrNull(idRead.value, 120);
    if (!id) return null;

    const sourceEventsRead = safeRead(raw, "sourceEvents");
    const causalRead = safeRead(raw, "causalLink");
    const interactionRead = safeRead(raw, "interaction");
    if (!sourceEventsRead.ok || !causalRead.ok || !interactionRead.ok) return null;

    const sourceEventsInput = sourceEventsRead.value ?? [];
    if (!Array.isArray(sourceEventsInput)) return null;
    const sourceEvents = cloneLocked(sourceEventsInput);
    const causalLink = cloneLocked(causalRead.value ?? null);
    const interaction = cloneLocked(interactionRead.value ?? null);
    if (!sourceEvents.ok || !causalLink.ok || !interaction.ok) return null;

    const startRead = safeRead(raw, "startState");
    const endRead = safeRead(raw, "endState");
    if (!startRead.ok || !endRead.ok) return null;
    const startState = normalizeOptionalState(startRead.value);
    const endState = normalizeOptionalState(endRead.value);
    if (!startState.ok || !endState.ok) return null;

    const castRead = safeRead(raw, "characters");
    if (!castRead.ok) return null;
    const characters = [];
    if (castRead.value != null) {
      if (!Array.isArray(castRead.value)) return null;
      const seen = new Set();
      for (let index = 0; index < castRead.value.length; index += 1) {
        const item = safeRead(castRead.value, index);
        if (!item.ok) return null;
        const character = asStringOrNull(item.value, 120);
        if (!character || seen.has(character)) return null;
        seen.add(character);
        characters.push(character);
      }
    }

    let kindResolver = options.kindResolver;
    if (kindResolver !== undefined && typeof kindResolver !== "function") return null;
    if (!kindResolver) {
      const context = buildKindContext([raw]);
      if (!context.ok) return null;
      kindResolver = context.kindResolver;
    }

    const stateChangesRead = safeRead(raw, "stateChanges");
    if (!stateChangesRead.ok) return null;
    const stateChanges = normalizeStateChanges(stateChangesRead.value, { kindResolver });
    if (!stateChanges.ok) return null;

    const fields = {};
    for (const [key, max] of [
      ["title", 200], ["purpose", 500], ["storyDetail", 2000],
      ["storyEventType", 80], ["sourceStoryText", 10000],
      ["visibleAction", 1000], ["camera", 1000], ["imagePrompt", 4000],
      ["motionPrompt", 3000]
    ]) {
      const read = safeRead(raw, key);
      if (!read.ok) return null;
      fields[key] = asStringOrNull(read.value, max) ?? "";
    }

    return {
      id,
      ...fields,
      sourceEvents: sourceEvents.value,
      characters,
      causalLink: causalLink.value,
      interaction: interaction.value,
      stateChanges: stateChanges.value,
      startState: startState.value,
      endState: endState.value
    };
  } catch {
    return null;
  }
}

export function normalizeScenes(scenes) {
  try {
    if (!Array.isArray(scenes) || scenes.length > MAX_SCENES) return null;
    const context = buildKindContext(scenes);
    if (!context.ok) return null;

    const result = [];
    const seenIds = new Set();
    for (let index = 0; index < scenes.length; index += 1) {
      const raw = safeRead(scenes, index);
      if (!raw.ok) return null;
      const normalized = normalizeScene(raw.value, { kindResolver: context.kindResolver });
      if (!normalized || seenIds.has(normalized.id)) return null;
      seenIds.add(normalized.id);
      if (hasConflictingIdInState(normalized, context.conflictingIds)) return null;
      result.push(normalized);
    }
    return result;
  } catch {
    return null;
  }
}
