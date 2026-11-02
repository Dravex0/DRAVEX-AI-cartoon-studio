import test from "node:test";
import assert from "node:assert/strict";
import { normalizeScene } from "../src/scene-model.js";

test("preserves structured start and end snapshots for continuity consumers", () => {
  const scene = normalizeScene({
    id: "scene_1",
    startStateData: {
      location: "village square",
      time: "morning",
      weather: "clear",
      characters: {
        Mira: { location: "beside the fountain", position: "left", pose: "standing", clothing: "blue coat" }
      },
      objects: {
        key: { location: "Mira's right hand", owner: "Mira", state: "held" }
      }
    },
    endStateData: {
      location: "village square",
      time: "morning",
      weather: "clear",
      characters: {
        Mira: { location: "beside the fountain", position: "center", pose: "reaching", clothing: "blue coat" }
      },
      objects: {
        key: { location: "Mira's right hand", owner: "Mira", state: "held" }
      }
    }
  });

  assert.equal(scene.startStateData.location, "village square");
  assert.equal(scene.startStateData.characters.Mira.clothing, "blue coat");
  assert.equal(scene.endStateData.characters.Mira.position, "center");
  assert.equal(scene.endStateData.objects.key.owner, "Mira");
});

test("keeps unknown structured state values null and does not invent snapshots", () => {
  const scene = normalizeScene({
    startStateData: { location: null, characters: { Mira: { pose: null } } }
  });

  assert.equal(scene.startStateData.location, null);
  assert.equal(scene.startStateData.characters.Mira.pose, null);
  assert.equal(scene.endStateData, null);
});

test("drops unsupported fields and malformed entity records from structured state", () => {
  const scene = normalizeScene({
    startStateData: {
      location: "forest",
      secretModelThought: "unsupported",
      characters: {
        Mira: { pose: "walking", untrustedExtra: "discard me" },
        invalid: "not-an-object"
      }
    }
  });

  assert.equal(scene.startStateData.secretModelThought, undefined);
  assert.equal(scene.startStateData.characters.Mira.untrustedExtra, undefined);
  assert.deepEqual(scene.startStateData.characters.invalid, undefined);
});

test("malformed structured snapshots normalize to null", () => {
  assert.equal(normalizeScene({ startStateData: "not an object" }).startStateData, null);
  assert.equal(normalizeScene({ endStateData: [] }).endStateData, null);
});
