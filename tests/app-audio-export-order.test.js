import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

test('starts the WebM recorder before scheduling local music and dialogue', () => {
  const start = appSource.indexOf('async function exportFilm(');
  assert.notEqual(start, -1, 'film export function must exist');
  const end = appSource.indexOf("\n$('export').onclick", start);
  assert.ok(end > start, 'film export function must have a closing action binding');
  const exportBlock = appSource.slice(start, end);
  const recorderStart = exportBlock.indexOf('recorder.start(250);');
  const audioStart = exportBlock.indexOf('await audioSession.start()');
  const mouthOffset = exportBlock.indexOf('getAudioTimelineOffsetMs(');
  assert.ok(recorderStart >= 0, 'MediaRecorder must start');
  assert.ok(audioStart > recorderStart, 'audio clock must start after MediaRecorder');
  assert.ok(mouthOffset > audioStart, 'lip-sync offsets must use the scheduled audio start');
  assert.ok(exportBlock.includes('musicBlob:musicFile'), 'selected local music must use decoded Blob scheduling');
  assert.ok(!exportBlock.includes('new Audio(selectedMusicUrl)'), 'export must not advance an HTML audio element before recording');
});
