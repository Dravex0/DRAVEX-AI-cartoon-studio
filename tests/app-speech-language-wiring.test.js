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
