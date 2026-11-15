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
