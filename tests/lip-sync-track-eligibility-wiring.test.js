import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("WebM export filters lip-sync analysis to renderable facial mouths", () => {
  const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(app, /import \{ selectRenderableLipSyncTracks \} from ["']\.\/lip-sync-track-eligibility\.js["']/);
  assert.match(app, /const lipSyncRenderableTracks=selectRenderableLipSyncTracks\(\{[\s\S]*?voiceTracks,[\s\S]*?sceneMetadata,[\s\S]*?mainCharacterKey,[\s\S]*?storyUsesFallback[\s\S]*?\}\)/);
  assert.match(app, /no renderable facial mouth rig or built-in preview character is available/i);
  assert.match(app, /нет доступного лицевого рига с ртом или встроенного персонажа предпросмотра/i);
  assert.doesNotMatch(app, /return track\.characterName\.trim\(\)\.toLowerCase\(\)===mainCharacterKey\|\|hasFacialRig/);
});
