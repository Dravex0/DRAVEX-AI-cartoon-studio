import test from 'node:test';
import assert from 'node:assert/strict';
import { drawImageCover, getImageCoverCrop } from '../src/image-frame.js';

test('cover crop fills a wide viewport from a portrait image without distortion', () => {
  const crop = getImageCoverCrop(1000, 1500, 1280, 720);
  assert.ok(crop);
  assert.equal(crop.sw, 1000);
  assert.equal(crop.sh, 562.5);
  assert.equal(crop.sx, 0);
  assert.equal(crop.sy, 468.75);
  assert.equal(crop.dw, 1280);
  assert.equal(crop.dh, 720);
});

test('cover crop fills a portrait viewport from a landscape image', () => {
  const crop = getImageCoverCrop(1920, 1080, 720, 1280);
  assert.ok(crop);
  assert.equal(crop.sw, 607.5);
  assert.equal(crop.sh, 1080);
  assert.equal(crop.sx, 656.25);
  assert.equal(crop.sy, 0);
});

test('zoom and pan remain within image bounds', () => {
  const crop = getImageCoverCrop(1600, 900, 1280, 720, 1.2, 1, -1);
  assert.ok(crop);
  assert.ok(crop.sx >= 0 && crop.sy >= 0);
  assert.ok(crop.sx + crop.sw <= 1600);
  assert.ok(crop.sy + crop.sh <= 900);
});

test('invalid image or viewport dimensions return null', () => {
  assert.equal(getImageCoverCrop(0, 100, 100, 100), null);
  assert.equal(getImageCoverCrop(100, 100, NaN, 100), null);
  assert.equal(getImageCoverCrop(-1, 100, 100, 100), null);
});

test('drawImageCover uses the calculated source and destination rectangles', () => {
  const calls = [];
  const context = { drawImage: (...args) => calls.push(args) };
  const image = { naturalWidth: 800, naturalHeight: 600 };
  assert.equal(drawImageCover(context, image, 400, 300), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], image);
  assert.deepEqual(calls[0].slice(1), [0, 0, 800, 600, 0, 0, 400, 300]);
});


test('drawImageCover supports video dimensions when drawing generated scene clips', () => {
  const calls = [];
  const context = { drawImage: (...args) => calls.push(args) };
  const video = { videoWidth: 1920, videoHeight: 1080, readyState: 2 };
  assert.equal(drawImageCover(context, video, 640, 420), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], video);
  assert.equal(calls[0][1], 137.1428571428571);
  assert.equal(calls[0][2], 0);
  assert.equal(calls[0][3], 1645.7142857142858);
  assert.equal(calls[0][4], 1080);
  assert.equal(calls[0][7], 640);
  assert.equal(calls[0][8], 420);
});

test('drawImageCover safely rejects incomplete image objects', () => {
  const context = { drawImage() { throw new Error('must not be called'); } };
  assert.equal(drawImageCover(context, { naturalWidth: 0, naturalHeight: 0 }, 400, 300), false);
  assert.equal(drawImageCover(null, {}, 400, 300), false);
});
