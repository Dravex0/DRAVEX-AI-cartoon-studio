import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

test('prompt-to-film speech planning validates existing voice artifacts against the active story language', () => {
  const start = appSource.indexOf("$('generateFullFilmComfy').addEventListener");
  assert.notEqual(start, -1, 'full-film generation handler must exist');

  const end = appSource.indexOf('filmProgressSceneStates=scenes.map', start);
  assert.ok(end > start, 'full-film speech preparation block must be present');

  const speechBlock = appSource.slice(start, end);
  const calls = speechBlock.split('resolveAutomaticSpeechTasks({').slice(1);
  assert.equal(calls.length, 2, 'the initial and post-dialogue checks must both run');

  for (const tail of calls) {
    const callEnd = tail.indexOf('})');
    assert.ok(callEnd >= 0, 'speech planner call must be complete');
    assert.ok(tail.slice(0, callEnd).includes('language:storyLanguage()'),
      'the resolver must reject voice cues generated in a different story language');
  }
});


test('stops the one-click export when requested speech preparation fails', () => {
  const start = appSource.indexOf("if(speechPreparation.status==='skipped')");
  const end = appSource.indexOf('const motionPreparation=prepareAutomaticCharacterMotion()', start);
  assert.ok(start >= 0 && end > start, 'speech failure branch must precede motion and export');
  const failureBranch = appSource.slice(start, end);
  assert.match(failureBranch, /Озвучка не подготовлена — экспорт остановлен/);
  assert.match(failureBranch, /return;/, 'failed requested speech must stop the film workflow');
});

test('draws the fallback character after generated scene media so the background cannot cover it', () => {
  const media = appSource.indexOf('if(hasGeneratedVideo){drawImageCover');
  const fallback = appSource.indexOf('if(showDemoFox){drawProceduralDemoFox', media);
  const layers = appSource.indexOf('drawCharacterLayers(ctx,currentSceneData.characterLayers', media);
  assert.ok(media >= 0 && fallback > media && layers > fallback,
    'background media must render first, then fallback character, then authored character layers');
});


test('blocks Hugging Face and ComfyUI generation when requested speech preparation fails', () => {
  const handler = appSource.indexOf("$('generateFullFilmComfy').addEventListener");
  const skipped = appSource.indexOf("if(speechPreparation.status==='skipped')", handler);
  const videoStart = appSource.indexOf("generateStoryboardVideos({", handler);
  assert.ok(handler >= 0 && skipped > handler && videoStart > skipped,
    'full video provider handler must validate speech before starting scene generation');
  const failureBranch = appSource.slice(skipped, videoStart);
  assert.match(failureBranch, /Озвучка не подготовлена — генерация фильма остановлена/);
  assert.match(failureBranch, /throw new Error\(message\)/,
    'unavailable requested dialogue audio must abort the remote/local video-provider pipeline');
});


test('blocks local-canvas export when a scene background is present but character visuals are missing', () => {
  const handler = appSource.indexOf("$('makeFilm').addEventListener");
  const gate = appSource.indexOf('const missingCharacterAssetCount=', handler);
  const evaluate = appSource.indexOf('const gate=evaluatePromptToFilmStart({', gate);
  const blocker = appSource.indexOf("gate.blockers.includes('character-visual-assets-required')", evaluate);
  assert.ok(handler >= 0 && gate > handler && evaluate > gate && blocker > evaluate,
    'character visual readiness must be checked before local-canvas export starts');
  const readiness = appSource.slice(gate, evaluate);
  assert.match(readiness, /getMissingCharacterVisualCount\\(requestedCharacter\\)/);
  const helperStart = appSource.indexOf('function getMissingCharacterVisualCount(');
  const helperEnd = appSource.indexOf("$('makeFilm').addEventListener", helperStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart, 'shared character visual readiness helper must exist before the start handler');
  const helper = appSource.slice(helperStart, helperEnd);
  assert.match(helper, /countScenesMissingCharacterVisuals/);
  assert.match(helper, /sceneVideoCache/);
  assert.match(helper, /proceduralFallback/);
  assert.doesNotMatch(helper, /generatedImageUrl/,
    'a generated scene background is not proof that a character is visible');
  assert.match(appSource.slice(blocker, blocker + 900), /Фоновое видео вместо мультфильма создавать не будем/);
});
