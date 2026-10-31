import { normalizeScenes } from "./scene-state-contract.js";

const MAX_SCENES = 1000;
const KNOWN_OBJECT_LOSS_STATES = new Set(["missing", "disappeared", "lost", "destroyed"]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function known(value) {
  return typeof value === "string" && value.length > 0;
}

function stateEntries(state) {
  const entries = [];
  if (!state) return entries;

  for (const property of ["location", "time", "weather"]) {
    if (known(state[property])) {
      entries.push({ entity: "scene", kind: "scene", property, value: state[property] });
    }
  }

  for (const [entity, fields] of Object.entries(state.characters)) {
    if (!fields) continue;
    for (const property of ["location", "position", "pose", "clothing"]) {
      if (known(fields[property])) {
        entries.push({ entity, kind: "character", property, value: fields[property] });
      }
    }
  }

  for (const [entity, fields] of Object.entries(state.objects)) {
    if (!fields) continue;
    for (const property of ["location", "owner", "state"]) {
      if (known(fields[property])) {
        entries.push({ entity, kind: "object", property, value: fields[property] });
      }
    }
  }
  return entries;
}

function stateValue(state, kind, entity, property) {
  if (!state) return null;
  if (kind === "scene") return state[property] ?? null;
  const group = kind === "character" ? state.characters : state.objects;
  return group?.[entity]?.[property] ?? null;
}

function sourceEvidenceMatches(scene, evidence) {
  if (!known(evidence)) return false;
  if (scene.storyDetail.includes(evidence) || scene.visibleAction.includes(evidence)) return true;

  return scene.sourceEvents.some(event => {
    if (typeof event === "string") return event.includes(evidence);
    if (!isRecord(event)) return false;
    return ["evidence", "text", "description"].some(field =>
      typeof event[field] === "string" && event[field].includes(evidence)
    );
  });
}

function transitionKey(entity, property, previousValue, value) {
  return JSON.stringify([entity, property, previousValue, value]);
}

function makeIssue(code, severity, previousSceneId, sceneId, details = {}) {
  return {
    code,
    severity,
    previousSceneId,
    sceneId,
    ...details
  };
}

/**
 * Build an immutable-by-convention, normalized memory snapshot for continuity QA.
 * Returns null for malformed input; does not mutate source scenes.
 */
export function buildSceneStateMemory(rawScenes) {
  const scenes = normalizeScenes(rawScenes);
  if (!scenes || scenes.length > MAX_SCENES) return null;

  return {
    schemaVersion: 1,
    sceneCount: scenes.length,
    scenes
  };
}

/**
 * Validate end-state -> next start-state hand-offs.
 *
 * Missing/null fields are treated as unknown, never as deletion. A transition is
 * accepted only when the next scene contains an exact stateChange whose evidence
 * is also present in that scene's story detail, visible action, or source events.
 * This is structured-state validation, not visual inspection of rendered frames.
 */
function validateSceneStateContinuityUnsafe(candidateMemory) {
  if (!isRecord(candidateMemory)
      || candidateMemory.schemaVersion !== 1
      || !Array.isArray(candidateMemory.scenes)
      || candidateMemory.scenes.length > MAX_SCENES
      || candidateMemory.sceneCount !== candidateMemory.scenes.length) {
    return {
      passed: false,
      checkedTransitions: 0,
      issues: [{ code: "malformed-memory", severity: "error" }]
    };
  }

  const scenes = normalizeScenes(candidateMemory.scenes);
  if (!scenes || scenes.length !== candidateMemory.sceneCount) {
    return {
      passed: false,
      checkedTransitions: 0,
      issues: [{ code: "malformed-memory", severity: "error" }]
    };
  }

  const issues = [];
  let checkedTransitions = 0;

  for (let index = 1; index < scenes.length; index += 1) {
    const previous = scenes[index - 1];
    const current = scenes[index];
    if (!previous.endState || !current.startState) continue;
    checkedTransitions += 1;

    const before = stateEntries(previous.endState);
    const changes = current.stateChanges;
    const authorizedTransitions = new Set(
      changes.filter(change => sourceEvidenceMatches(current, change.evidence)).map(change =>
        transitionKey(change.entity, change.property, change.previousValue, change.value))
    );

    for (const entry of before) {
      const nextValue = stateValue(current.startState, entry.kind, entry.entity, entry.property);

      // Omitted and null values carry no assertion about disappearance or deletion.
      if (!known(nextValue) || nextValue === entry.value) continue;

      if (authorizedTransitions.has(
        transitionKey(entry.entity, entry.property, entry.value, nextValue)
      )) continue;

      if (entry.kind === "character" && entry.property === "location") {
        issues.push(makeIssue(
          "character-teleportation",
          "warning",
          previous.id,
          current.id,
          { characterId: entry.entity, from: entry.value, to: nextValue }
        ));
      } else if (entry.kind === "object" && entry.property === "owner") {
        issues.push(makeIssue(
          "object-owner-change-unexplained",
          "warning",
          previous.id,
          current.id,
          { objectId: entry.entity, from: entry.value, to: nextValue }
        ));
      } else {
        issues.push(makeIssue(
          "state-transition-unexplained",
          "warning",
          previous.id,
          current.id,
          { entity: entry.entity, entityKind: entry.kind, property: entry.property,
            from: entry.value, to: nextValue }
        ));
      }
    }

    // An explicit loss marker is meaningful; an absent/null object is not.
    for (const [objectId, objectState] of Object.entries(current.startState.objects)) {
      const lossState = objectState?.state?.toLocaleLowerCase();
      if (!KNOWN_OBJECT_LOSS_STATES.has(lossState)) continue;
      const wasTracked = previous.endState.objects[objectId];
      if (!wasTracked || !known(wasTracked.state)
          || KNOWN_OBJECT_LOSS_STATES.has(wasTracked.state.toLocaleLowerCase())) continue;
      const lossIsExplained = authorizedTransitions.has(
        transitionKey(objectId, "state", wasTracked.state, objectState.state)
      );
      if (!lossIsExplained) {
        issues.push(makeIssue(
          "object-disappearance-unexplained",
          "warning",
          previous.id,
          current.id,
          { objectId, previousState: wasTracked.state, currentState: objectState.state }
        ));
      }
    }
  }

  return {
    passed: issues.length === 0,
    checkedTransitions,
    issues
  };
}


/** Public fail-closed boundary for malformed records, proxies, and hostile getters. */
export function validateSceneStateContinuity(candidateMemory) {
  try {
    return validateSceneStateContinuityUnsafe(candidateMemory);
  } catch {
    return {
      passed: false,
      checkedTransitions: 0,
      issues: [{ code: "malformed-memory", severity: "error" }]
    };
  }
}
