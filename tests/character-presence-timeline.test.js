import test from "node:test";
import assert from "node:assert/strict";
import { buildCharacterPresenceTimeline } from "../src/character-presence-timeline.js";

test("camera change and cast omission keep a character offscreen, not exited", () => {
  const timeline = buildCharacterPresenceTimeline([
    { id: "s1", camera: "wide", characters: ["Kel", "Rival"] },
    { id: "s2", camera: "close-up", characters: ["Rival"] },
    { id: "s3", camera: "medium", characters: ["Kel", "Rival"] }
  ]);
  assert.equal(timeline[1].cameraCut, true);
  assert.equal(timeline[1].characters.find(item => item.characterId === "Kel").status, "offscreen");
  assert.equal(timeline[2].characters.find(item => item.characterId === "Kel").status, "visible");
});

test("only explicit structured exit events mark a character exited", () => {
  const timeline = buildCharacterPresenceTimeline([
    { id: "s1", characters: ["Kel"] },
    { id: "s2", characters: [], storyDetail: "Kel is not mentioned in this shot." },
    { id: "s3", characters: [], presenceEvents: [{ type: "exit", characterId: "Kel" }] }
  ]);
  assert.equal(timeline[1].characters[0].status, "offscreen");
  assert.equal(timeline[2].characters[0].status, "exited");
});

test("an omitted camera label does not fabricate a camera cut", () => {
  const timeline = buildCharacterPresenceTimeline([
    { id: "s1", camera: "wide", characters: ["Kel"] },
    { id: "s2", characters: ["Rival"] }
  ]);
  assert.equal(timeline[1].cameraCut, false);
  assert.equal(timeline[1].characters.find(item => item.characterId === "Kel").status, "offscreen");
});

test("empty or malformed storyboard input returns an empty timeline", () => {
  assert.deepEqual(buildCharacterPresenceTimeline(null), []);
  assert.deepEqual(buildCharacterPresenceTimeline([]), []);
});
