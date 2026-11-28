import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

test("scene dialogue editor is synchronized before one-click speech planning", () => {
  assert.match(app, /import \{ syncSceneDialogueDraft \} from ["']\.\/scene-dialogue-sync\.js["']/);
  const helperStart = app.indexOf("function persistCurrentSceneDialogueToMetadata");
  const helperEnd = app.indexOf("function isLocalDialogueGenerationReady", helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  assert.match(app.slice(helperStart, helperEnd), /syncSceneDialogueDraft\(previous,currentLines\)/);

  const makeFilmStart = app.indexOf("$('makeFilm').addEventListener('click',async()=>{");
  const makeFilmSync = app.indexOf("persistCurrentSceneDialogueToMetadata(storyLanguage());", makeFilmStart);
  const makeFilmPlan = app.indexOf("const speechPlan=resolveAutomaticSpeechTasks(", makeFilmStart);
  assert.ok(makeFilmStart >= 0 && makeFilmSync > makeFilmStart && makeFilmPlan > makeFilmSync,
    "one-click film creation must read the current dialogue editor before deciding whether speech is required");
});

test("direct full-film provider action also synchronizes the active dialogue editor before speech planning", () => {
  const handlerStart = app.indexOf("$('generateFullFilmComfy').addEventListener('click',async()=>{");
  const sync = app.indexOf("persistCurrentSceneDialogueToMetadata(storyLanguage());", handlerStart);
  const plan = app.indexOf("const speechTasks=resolveAutomaticSpeechTasks({request:$('idea').value", handlerStart);
  assert.ok(handlerStart >= 0 && sync > handlerStart && plan > sync,
    "direct provider generation must not ignore unsaved dialogue in the active scene editor");
});

test("standalone WebM export synchronizes dialogue and blocks stale or missing voice tracks", () => {
  const exportStart = app.indexOf("$('export').onclick=()=>{");
  const sync = app.indexOf("persistCurrentSceneDialogueToMetadata(storyLanguage());", exportStart);
  const speechPlan = app.indexOf("const speechPlan=resolveAutomaticSpeechTasks({request:'',scenes:sceneMetadata", exportStart);
  const exportCall = app.indexOf("void exportFilm().catch", exportStart);
  assert.ok(exportStart >= 0 && sync > exportStart && speechPlan > sync && exportCall > speechPlan,
    "standalone export must synchronize dialogue and validate voice tracks before recording");
  const handler = app.slice(exportStart, app.indexOf("try{const saved=JSON.parse", exportStart));
  assert.match(handler, /speechPlan\.scenesMissingVoice\.length/);
  assert.match(handler, /после изменения диалогов нет актуальных голосовых дорожек/);
});
