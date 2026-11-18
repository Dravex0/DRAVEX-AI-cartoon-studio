import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

test('What-if episode import is exposed in the main story creation UI', () => {
  assert.match(html, /id="importWhatIfEpisode"/);
  assert.match(html, /accept="application\/json,\.json"/);
});

test('What-if import uses the bounded adapter and rejects oversized files', () => {
  assert.match(app, /import \{ convertWhatIfEpisode \} from ['"]\.\/what-if-episode-adapter\.js['"]/);
  assert.match(app, /file\.size>5\*1024\*1024/);
  assert.match(app, /convertWhatIfEpisode\(parsed/);
  assert.match(app, /updateStoryQA\(\)/);
});

test('imported narration is retained as source text and is not falsely marked as synthesized voice', () => {
  assert.match(app, /sourceText:importedScenes\.map\(scene=>scene\.sourceStoryText\)/);
  assert.match(app, /importedWhatIf:true/);
  assert.doesNotMatch(app, /importWhatIfEpisode[\s\S]{0,5000}voiceTimeline\s*=/);
});

test('What-if import reuses available character assets and prepares automatic motion', () => {
  assert.match(app, /reusableCharacterAssets/);
  assert.match(app, /characterRigs:merge\('characterRigs'\)/);
  assert.match(app, /const motionPreparation=prepareAutomaticCharacterMotion\(\)/);
  assert.match(app, /actionTimeline/);
});
