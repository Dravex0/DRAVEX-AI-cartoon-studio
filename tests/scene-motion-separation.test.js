import test from "node:test";
import assert from "node:assert/strict";
import { buildBackgroundControlRegions, classifyCharacterBackgroundMotion } from "../src/scene-motion-separation.js";

const character = { status: "visible-change" };
const stillCharacter = { status: "likely-static" };
const changed = { status: "visible-change" };
const stable = { status: "likely-static" };

test("selects stable-ID background tiles outside expanded character bounds", () => {
  const regions = buildBackgroundControlRegions({
    viewport: { width: 500, height: 500 },
    characterRegions: [{ bounds: { x: 180, y: 180, width: 140, height: 140 } }],
    columns: 5,
    rows: 5,
    maxRegions: 20
  });
  assert.ok(regions.length > 0);
  assert.ok(regions.every(region => /^bg-\d-\d$/.test(region.id)));
  assert.ok(regions.every(region => region.bounds.width === 100 && region.bounds.height === 100));
  assert.ok(!regions.some(region => region.id === "bg-2-2"));
});

test("returns no background controls when character bounds cover the full viewport", () => {
  const regions = buildBackgroundControlRegions({
    viewport: { width: 320, height: 180 },
    characterRegions: [{ x: 0, y: 0, width: 320, height: 180 }]
  });
  assert.deepEqual(regions, []);
});

test("rejects invalid viewport and grid settings", () => {
  assert.throws(() => buildBackgroundControlRegions({ viewport: { width: 0, height: 10 } }), /positive viewport/);
  assert.throws(() => buildBackgroundControlRegions({ viewport: { width: 10, height: 10 }, columns: 1 }), /settings/);
});

test("classifies character-only pixel changes when background controls stay stable", () => {
  const result = classifyCharacterBackgroundMotion(character, [stable, stable, stable]);
  assert.equal(result.status, "character-localized-change");
});

test("classifies widespread character and background changes as scene-wide or mixed", () => {
  const result = classifyCharacterBackgroundMotion(character, [changed, changed, stable]);
  assert.equal(result.status, "scene-wide-or-mixed-change");
  assert.match(result.limitation, /not camera tracking/);
});

test("does not label a static character as animated when only background controls change", () => {
  const result = classifyCharacterBackgroundMotion(stillCharacter, [changed, changed, stable]);
  assert.equal(result.status, "background-or-camera-change");
});

test("reports low visible change when both character and background remain stable", () => {
  const result = classifyCharacterBackgroundMotion(stillCharacter, [stable, stable]);
  assert.equal(result.status, "little-visible-change");
});

test("keeps minority background activity inconclusive and handles missing controls", () => {
  assert.equal(classifyCharacterBackgroundMotion(character, [changed, stable, stable]).status,
    "inconclusive-mixed-background");
  assert.equal(classifyCharacterBackgroundMotion(character, []).status,
    "insufficient-background-controls");
});
