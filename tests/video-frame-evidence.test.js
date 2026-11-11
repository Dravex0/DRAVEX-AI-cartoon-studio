import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRgbaFrameSequence } from './helpers/video-frame-evidence.js';

function solidFrame(width, height, red, green, blue) {
  const data = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = red;
    data[offset + 1] = green;
    data[offset + 2] = blue;
    data[offset + 3] = 255;
  }
  return { width, height, data };
}

test('classifies identical decoded frames as likely static', () => {
  const frame = solidFrame(8, 4, 80, 80, 80);
  const report = analyzeRgbaFrameSequence([frame, { ...frame, data: frame.data.slice() }]);
  assert.equal(report.status, 'likely-static');
  assert.equal(report.meanPixelChange, 0);
  assert.equal(report.changedPixelRatio, 0);
});

test('detects pixel changes without claiming semantic motion', () => {
  const report = analyzeRgbaFrameSequence([
    solidFrame(8, 4, 30, 30, 30),
    solidFrame(8, 4, 180, 100, 50)
  ]);
  assert.equal(report.status, 'visible-change');
  assert.ok(report.meanPixelChange > 0);
  assert.ok(report.changedPixelRatio > 0);
  assert.match(report.note, /do not identify a character/);
});

test('reports an orange-color hint without claiming character recognition', () => {
  const frame = solidFrame(10, 10, 220, 120, 50);
  const report = analyzeRgbaFrameSequence([frame, { ...frame, data: frame.data.slice() }]);
  assert.equal(report.orangeSignal, 'orange-pixels-detected');
  assert.ok(report.maxOrangePixelRatio > 0.9);
  assert.match(report.note, /heuristics only/);
});

test('reports a red-color hint without identifying a requested object', () => {
  const frame = solidFrame(10, 10, 220, 30, 25);
  const report = analyzeRgbaFrameSequence([frame, { ...frame, data: frame.data.slice() }]);
  assert.equal(report.redSignal, 'red-pixels-detected');
  assert.ok(report.maxRedPixelRatio > 0.9);
  assert.match(report.note, /do not identify a character, object, or action/);
});


test('reports where motion is concentrated instead of treating every pixel change equally', () => {
  const base = solidFrame(9, 9, 30, 30, 30);
  const data = base.data.slice();
  for (let y = 3; y < 6; y += 1) for (let x = 3; x < 6; x += 1) {
    const offset = (y * base.width + x) * 4;
    data.set([220, 30, 25, 255], offset);
  }
  const report = analyzeRgbaFrameSequence([base, { ...base, data }]);
  assert.equal(report.regionalMotion.gridSize, 3);
  assert.equal(report.regionalMotion.centerRegion.row, 1);
  assert.equal(report.regionalMotion.centerRegion.column, 1);
  assert.ok(report.regionalMotion.centerRegion.changedPixelRatio > 0);
  assert.equal(report.regionalMotion.activeRegionsByTransition.length, 1);
  assert.equal(report.regionalMotion.activeRegionsByTransition[0], 1);
});

test('does not mislabel a whole-frame lighting change as localized character movement', () => {
  const report = analyzeRgbaFrameSequence([
    solidFrame(9, 9, 30, 30, 30),
    solidFrame(9, 9, 45, 45, 45)
  ]);
  assert.equal(report.regionalMotion.activeRegionsByTransition[0], 9);
  assert.equal(report.regionalMotion.averageActiveRegionsPerTransition, 9);
});

test('ignores RGB values hidden under fully transparent pixels', () => {
  const hiddenOrange = new Uint8Array([220, 120, 50, 0, 80, 80, 80, 255]);
  const hiddenBlack = new Uint8Array([0, 0, 0, 0, 80, 80, 80, 255]);
  const report = analyzeRgbaFrameSequence([
    { width: 2, height: 1, data: hiddenOrange },
    { width: 2, height: 1, data: hiddenBlack }
  ]);
  assert.equal(report.status, 'likely-static');
  assert.equal(report.orangeSignal, 'low-orange-pixel-signal');
  assert.equal(report.redSignal, 'low-red-pixel-signal');
  assert.equal(report.meanPixelChange, 0);
});

test('rejects mismatched pixel-buffer dimensions', () => {
  assert.throws(
    () => analyzeRgbaFrameSequence([
      solidFrame(8, 4, 0, 0, 0),
      { width: 8, height: 4, data: new Uint8Array(3) }
    ]),
    /pixel data length/
  );
});

test('rejects inconsistent frame sizes and invalid sample counts', () => {
  assert.throws(
    () => analyzeRgbaFrameSequence([solidFrame(8, 4, 0, 0, 0), solidFrame(4, 4, 0, 0, 0)]),
    /identical dimensions/
  );
  assert.throws(() => analyzeRgbaFrameSequence([solidFrame(8, 4, 0, 0, 0)]), /between 2 and 12/);
});
