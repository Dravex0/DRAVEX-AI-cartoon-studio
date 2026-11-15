import test from "node:test";
import assert from "node:assert/strict";
import { createCharacterPresenceTracker } from "../src/character-presence-tracker.js";

test("camera cut moves visible character offscreen, not exited", () => {
  const tracker = createCharacterPresenceTracker(["Foxy", "Rival"]);
  tracker.update({ sceneId: "scene-1", visibleCharacterIds: ["Foxy", "Rival"] });
  const result = tracker.update({ sceneId: "scene-2", visibleCharacterIds: ["Rival"], cameraCut: true });
  const foxy = result.characters.find(item => item.characterId === "Foxy");
  assert.equal(foxy.status, "offscreen");
  assert.equal(foxy.lastSeenSceneId, "scene-1");
  assert.equal(foxy.lastTransition, "camera-cut");
});

test("only an explicit narrative exit marks a character exited", () => {
  const tracker = createCharacterPresenceTracker(["Foxy"]);
  tracker.update({ sceneId: "scene-1", visibleCharacterIds: ["Foxy"] });
  tracker.update({ sceneId: "scene-2", cameraCut: true });
  assert.equal(tracker.snapshot()[0].status, "offscreen");
  tracker.update({ sceneId: "scene-3", exitedCharacterIds: ["Foxy"] });
  assert.equal(tracker.snapshot()[0].status, "exited");
});

test("a previously exited character is not silently revived by a camera cut", () => {
  const tracker = createCharacterPresenceTracker(["Foxy"]);
  tracker.update({ sceneId: "scene-1", exitedCharacterIds: ["Foxy"] });
  tracker.update({ sceneId: "scene-2", cameraCut: true });
  assert.equal(tracker.snapshot()[0].status, "exited");
});

test("visible observation brings an offscreen character back into frame", () => {
  const tracker = createCharacterPresenceTracker(["Foxy"]);
  tracker.update({ sceneId: "scene-1", visibleCharacterIds: ["Foxy"] });
  tracker.update({ sceneId: "scene-2", cameraCut: true });
  const result = tracker.update({ sceneId: "scene-3", visibleCharacterIds: ["Foxy"] });
  assert.equal(result.characters[0].status, "visible");
  assert.equal(result.characters[0].lastSeenSceneId, "scene-3");
});
