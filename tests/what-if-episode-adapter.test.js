import test from 'node:test';
import assert from 'node:assert/strict';
import { convertWhatIfEpisode } from '../src/what-if-episode-adapter.js';

test('imports a What-if shot into the DRAVEX scene model without losing narration or staging', () => {
  const result = convertWhatIfEpisode({
    slug: 'one-minute-ahead',
    title: 'What If You See One Minute Ahead?',
    language: 'en',
    shots: [{
      beat: 'hook',
      say: 'You catch the ball before anyone throws it.',
      bg: 'park',
      time: 'day',
      camera: { size: 'wide', move: 'push', on: 'max' },
      actors: [{ who: 'max', x: 30, pose: 'catch', mood: 'smug' }],
      props: [{ type: 'ball', x: 73, y: 52, toX: 37, toY: 49 }],
      sfx: 'whoosh'
    }]
  }, { characterMap: { max: 'main-character' } });

  assert.equal(result.diagnostics.ok, true);
  assert.equal(result.scenes.length, 1);
  assert.deepEqual(result.scenes[0].characters, ['main-character']);
  assert.match(result.scenes[0].sourceStoryText, /catch the ball/);
  assert.match(result.scenes[0].imagePrompt, /park/);
  assert.match(result.scenes[0].motionPrompt, /catch/);
  assert.match(result.scenes[0].camera, /wide/);
  assert.equal(result.scenes[0].sound, 'whoosh');
});

test('reports unsupported renderer tokens instead of silently claiming they work', () => {
  const result = convertWhatIfEpisode({
    shots: [{ say: 'A hero flies.', bg: 'underwater-city', camera: { size: 'planetary', move: 'teleport' }, actors: [{ who: 'x', pose: 'laser-dance' }], fx: ['portal'] }]
  });
  assert.equal(result.diagnostics.ok, true);
  assert.equal(result.diagnostics.warnings.length, 1);
  assert.ok(result.diagnostics.warnings[0].details.some(value => value.startsWith('background:')));
  assert.ok(result.scenes[0].prompt.includes('underwater-city'));
});

test('rejects an empty episode and caps oversized input', () => {
  assert.equal(convertWhatIfEpisode({ shots: [] }).diagnostics.ok, false);
  const oversized = convertWhatIfEpisode({ shots: Array.from({ length: 301 }, () => ({ say: 'A shot.' })) });
  assert.equal(oversized.diagnostics.ok, false);
  assert.equal(oversized.scenes.length, 300);
});

test('handles malformed input without throwing', () => {
  const result = convertWhatIfEpisode(null);
  assert.equal(result.diagnostics.ok, false);
  assert.equal(result.scenes.length, 0);
});
