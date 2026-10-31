import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeCharacterState,
  normalizeObjectState,
  normalizeState,
  normalizeStateChange,
  normalizeStateChanges,
  normalizeScene,
  normalizeScenes,
  emptyState
} from "../src/scene-state-contract.js";

function makeScene(id = "s1", overrides = {}) {
  return {
    id, title: "Opening", purpose: "Intro", storyDetail: "Alice enters.",
    storyEventType: "entrance", sourceStoryText: "Alice enters.",
    sourceEvents: [{ source: "story" }], characters: ["Alice"],
    causalLink: null, interaction: null, stateChanges: [],
    visibleAction: "walks", camera: "wide", imagePrompt: "img",
    motionPrompt: "mot", startState: null, endState: null,
    ...overrides
  };
}

test("normalizes character fields and drops extras", () => {
  assert.deepEqual(normalizeCharacterState({
    location: " kitchen ", position: "standing", pose: "holding-key",
    clothing: "blue-coat", extra: "drop"
  }), {
    location: "kitchen", position: "standing", pose: "holding-key", clothing: "blue-coat"
  });
});

test("rejects non-record character and object states", () => {
  for (const value of [null, "text", [], 42]) assert.equal(normalizeCharacterState(value), null);
  for (const value of [null, "text", [], 42]) assert.equal(normalizeObjectState(value), null);
});

test("normalizes object state", () => {
  assert.deepEqual(normalizeObjectState({ location: "Alice", owner: "Alice", state: "held", extra: 1 }), {
    location: "Alice", owner: "Alice", state: "held"
  });
});

test("normalizes structured state and defaults missing entity maps", () => {
  const state = normalizeState({
    location: " kitchen ", time: "morning", weather: "rain",
    characters: { Alice: { location: "kitchen" } },
    objects: { key: { owner: "Alice", state: "held" } },
    extra: "discard"
  });
  assert.equal(state.location, "kitchen");
  assert.equal(state.characters.Alice.position, null);
  assert.equal(state.objects.key.owner, "Alice");
  assert.equal(state.extra, undefined);
  assert.deepEqual(normalizeState({ location: "room" }).characters, {});
  assert.deepEqual(normalizeState({ location: "room" }).objects, {});
});

test("rejects malformed state maps and entries", () => {
  for (const characters of ["broken", [], 42]) {
    assert.equal(normalizeState({ characters }), null);
  }
  for (const objects of ["broken", [], 42]) {
    assert.equal(normalizeState({ objects }), null);
  }
  assert.equal(normalizeState({ characters: { Alice: "broken" } }), null);
  assert.equal(normalizeState({ objects: { key: "broken" } }), null);
});

test("rejects normalized entity-key collisions and dangerous keys", () => {
  assert.equal(normalizeState({
    characters: { Alice: { location: "kitchen" }, " Alice ": { location: "roof" } }
  }), null);
  const characters = JSON.parse('{"__proto__":{"location":"kitchen"}}');
  assert.equal(normalizeState({ characters }), null);
});

test("hostile getters fail closed without throwing", () => {
  const hostileCharacter = {};
  Object.defineProperty(hostileCharacter, "location", { get() { throw new Error("hostile"); } });
  assert.doesNotThrow(() => normalizeCharacterState(hostileCharacter));
  assert.equal(normalizeCharacterState(hostileCharacter), null);

  const hostileState = {};
  Object.defineProperty(hostileState, "location", { get() { throw new Error("hostile"); } });
  assert.equal(normalizeState(hostileState), null);
});

test("circular extra fields do not affect normalized state", () => {
  const raw = { location: "kitchen" };
  raw.self = raw;
  assert.doesNotThrow(() => normalizeState(raw));
  assert.equal(normalizeState(raw).location, "kitchen");
});

test("normalizes state changes with the entity/property contract", () => {
  const result = normalizeStateChange({
    entity: "Alice", property: "location", previousValue: "kitchen",
    value: "roof", actorId: "Alice", evidence: "Alice climbs."
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.value, "roof");
});

test("validates properties against the resolved entity kind", () => {
  assert.equal(normalizeStateChange({
    entity: "Alice", property: "owner", value: "Bob"
  }, { kindResolver: () => "character" }).ok, false);
  assert.equal(normalizeStateChange({
    entity: "key", property: "clothing", value: "blue"
  }, { kindResolver: () => "object" }).ok, false);
  assert.equal(normalizeStateChange({
    entity: "key", property: "owner", value: "Bob"
  }, { kindResolver: () => "object" }).ok, true);
  assert.equal(normalizeStateChange({
    entity: "scene", property: "time", value: "night"
  }, { kindResolver: () => "scene" }).ok, true);
  assert.equal(normalizeStateChange({
    entity: "ghost", property: "location", value: "attic"
  }, { kindResolver: () => null }).ok, false);
});

test("state change rejects missing required fields and hostile getters", () => {
  assert.equal(normalizeStateChange({ entity: "Alice", property: "location" }).ok, false);
  assert.equal(normalizeStateChange({ entity: "Alice", value: "roof" }).ok, false);
  const hostile = {};
  Object.defineProperty(hostile, "entity", { get() { throw new Error("hostile"); } });
  assert.equal(normalizeStateChange(hostile).ok, false);
});

test("stateChanges fail closed instead of filtering invalid entries", () => {
  const valid = normalizeStateChanges([
    { entity: "Alice", property: "location", value: "roof" }
  ], { kindResolver: () => "character" });
  assert.equal(valid.ok, true);
  assert.equal(valid.value.length, 1);
  const mixed = normalizeStateChanges([
    { entity: "Alice", property: "location", value: "roof" },
    { entity: "key", property: "clothing", value: "blue" }
  ], { kindResolver: entity => entity === "Alice" ? "character" : "object" });
  assert.equal(mixed.ok, false);
  assert.deepEqual(normalizeStateChanges(null).value, []);
  assert.equal(normalizeStateChanges("bad").ok, false);
});

test("normalizes a structured scene and preserves locked fields by deep copy", () => {
  const raw = makeScene("s1", {
    startState: { location: "kitchen", characters: { Alice: { location: "kitchen" } } },
    endState: { location: "roof", characters: { Alice: { location: "roof" } } },
    stateChanges: [{ entity: "Alice", property: "location", previousValue: "kitchen", value: "roof" }]
  });
  const normalized = normalizeScene(raw);
  assert.ok(normalized);
  assert.equal(normalized.startState.location, "kitchen");
  assert.equal(normalized.endState.location, "roof");
  normalized.sourceEvents.push({ changed: true });
  assert.equal(raw.sourceEvents.length, 1);
});

test("legacy state strings normalize to null, but malformed structured states reject scene", () => {
  const legacy = normalizeScene(makeScene("legacy", {
    startState: "Alice in kitchen", endState: "Alice on roof"
  }));
  assert.equal(legacy.startState, null);
  assert.equal(legacy.endState, null);
  assert.equal(normalizeScene(makeScene("broken", {
    startState: { characters: "broken", objects: {} }
  })), null);
  assert.equal(normalizeScene(makeScene("broken-end", { endState: [] })), null);
});

test("rejects any invalid stateChange and invalid locked JSON data", () => {
  assert.equal(normalizeScene(makeScene("bad-change", {
    stateChanges: [
      { entity: "Alice", property: "location", value: "roof" },
      { entity: "key", property: "clothing", value: "blue" }
    ]
  })), null);
  const circular = {};
  circular.self = circular;
  assert.equal(normalizeScene(makeScene("circular", { sourceEvents: [circular] })), null);
  assert.equal(normalizeScene(makeScene("bigint", { sourceEvents: [1n] })), null);
  assert.equal(normalizeScene(makeScene("function", { sourceEvents: [() => {}] })), null);
  assert.equal(normalizeScene(makeScene("date", { sourceEvents: [new Date()] })), null);
});

test("direct normalizeScene resolves characters and objects from its own state", () => {
  const scene = makeScene("direct", {
    startState: { objects: { key: { location: "table", owner: null, state: "on-table" } } },
    stateChanges: [{ entity: "key", property: "owner", value: "Alice" }]
  });
  assert.ok(normalizeScene(scene));
});

test("normalizeScenes rejects duplicate scene IDs, unknown entities, and conflicting IDs", () => {
  assert.equal(normalizeScenes([makeScene("same"), makeScene("same")]), null);
  assert.equal(normalizeScenes([makeScene("unknown", {
    stateChanges: [{ entity: "ghost", property: "location", value: "attic" }]
  })]), null);
  const conflict = makeScene("conflict", {
    characters: ["key"],
    startState: {
      characters: { key: { location: "table" } },
      objects: { key: { location: "table", owner: null, state: "resting" } }
    }
  });
  assert.equal(normalizeScenes([conflict]), null);
});

test("normalizeScenes rejects a malformed scene and preserves input immutability", () => {
  const scenes = [makeScene("s1"), makeScene("s2", { sourceEvents: [1n] })];
  assert.equal(normalizeScenes(scenes), null);
  const input = [makeScene("safe")];
  const snapshot = JSON.stringify(input);
  assert.ok(normalizeScenes(input));
  assert.equal(JSON.stringify(input), snapshot);
});

test("normalizeScenes catches hostile proxies", () => {
  const hostile = new Proxy({}, { ownKeys() { throw new Error("hostile proxy"); } });
  assert.doesNotThrow(() => normalizeScenes([hostile]));
  assert.equal(normalizeScenes([hostile]), null);
});

test("revoked proxies fail closed in public normalizers", () => {
  const revokedRecord = Proxy.revocable({}, {});
  revokedRecord.revoke();
  assert.doesNotThrow(() => normalizeState(revokedRecord.proxy));
  assert.equal(normalizeState(revokedRecord.proxy), null);

  const revokedArray = Proxy.revocable([], {});
  revokedArray.revoke();
  assert.doesNotThrow(() => normalizeStateChanges(revokedArray.proxy));
  assert.equal(normalizeStateChanges(revokedArray.proxy).ok, false);
});

test("hostile kindResolver option fails closed", () => {
  const options = {};
  Object.defineProperty(options, "kindResolver", {
    get() { throw new Error("hostile options"); }
  });
  assert.doesNotThrow(() => normalizeStateChange({
    entity: "Alice", property: "location", value: "roof"
  }, options));
  assert.equal(normalizeStateChange({
    entity: "Alice", property: "location", value: "roof"
  }, options).ok, false);
});

test("emptyState returns a complete fresh structure", () => {
  const first = emptyState();
  const second = emptyState();
  assert.deepEqual(first, {
    location: null, time: null, weather: null, characters: {}, objects: {}
  });
  assert.notEqual(first, second);
  assert.notEqual(first.characters, second.characters);
});
