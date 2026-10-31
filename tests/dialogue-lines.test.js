import test from "node:test";
import assert from "node:assert/strict";
import { formatDialogueLines, parseDialogueLines } from "../src/dialogue-lines.js";

test("parses named speakers and keeps the selected language", () => {
  assert.deepEqual(parseDialogueLines("Foxy: Hello!\nBird — Good morning.", "en"), [
    { characterId: "Foxy", text: "Hello!", language: "en" },
    { characterId: "Bird", text: "Good morning.", language: "en" }
  ]);
});

test("preserves unlabelled narration without inventing a character", () => {
  assert.deepEqual(parseDialogueLines("The wind grows louder.", "ru"), [
    { characterId: "Narrator", text: "The wind grows louder.", language: "ru" }
  ]);
});

test("formats saved dialogue for editing", () => {
  assert.equal(formatDialogueLines([
    { characterId: "Foxy", text: "Привет!" },
    { characterId: "", text: "Звучит музыка." }
  ]), "Foxy: Привет!\nNarrator: Звучит музыка.");
});

test("limits dialogue to thirty non-empty lines and normalizes unsupported language", () => {
  const source = Array.from({ length: 35 }, (_, index) => "Hero: Line " + index).join("\n");
  const parsed = parseDialogueLines(source, "fr");
  assert.equal(parsed.length, 30);
  assert.equal(parsed[0].language, "en");
  assert.equal(parsed[29].text, "Line 29");
});
