import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHARACTER_LAYER_LIMIT,
  drawCharacterLayers,
  drawCharacterRigParts,
  normalizeCharacterLayer,
  normalizeCharacterLayers
} from '../src/scene-character-layers.js';

test('normalizes independent sprite geometry and keeps viewport-relative defaults', () => {
  assert.deepEqual(normalizeCharacterLayer({ characterId: ' Foxy ', imageUrl: 'blob:fox' }), {
    characterId: 'Foxy', imageUrl: 'blob:fox', x: 0.5, y: 0.5,
    width: 0.25, height: 0.4, rotation: 0, scale: 1, opacity: 1,
    zIndex: 0, flipX: false, visible: true
  });
});

test('clamps invalid and extreme layer geometry to safe bounds', () => {
  const layer = normalizeCharacterLayer({
    characterId: 'Foxy', imageUrl: 'blob:fox', x: 9, y: -2,
    width: 0, height: 8, rotation: 99, scale: 20, opacity: -1, zIndex: 9000
  });
  assert.equal(layer.x, 1);
  assert.equal(layer.y, 0);
  assert.equal(layer.width, 0.01);
  assert.equal(layer.height, 2);
  assert.equal(layer.rotation, Math.PI * 2);
  assert.equal(layer.scale, 4);
  assert.equal(layer.opacity, 0);
  assert.equal(layer.zIndex, 1000);
});

test('deduplicates character identities and caps the number of layers', () => {
  const layers = Array.from({ length: CHARACTER_LAYER_LIMIT + 3 }, (_, index) => ({
    characterId: 'Character ' + index, imageUrl: 'blob:' + index
  }));
  layers.splice(1, 0, { characterId: 'character 0', imageUrl: 'blob:duplicate' });
  const result = normalizeCharacterLayers(layers);
  assert.equal(result.length, CHARACTER_LAYER_LIMIT);
  assert.equal(result[0].imageUrl, 'blob:0');
  assert.equal(result.some(layer => layer.imageUrl === 'blob:duplicate'), false);
});

test('ignores malformed layers, missing identities, and missing assets', () => {
  assert.deepEqual(normalizeCharacterLayers([
    null, [], { imageUrl: 'blob:no-id' }, { characterId: 'Foxy' },
    { characterId: 'Bird', imageUrl: 'blob:bird' }
  ]).map(layer => layer.characterId), ['Bird']);
});

test('draws independent character layers in stable z-index order with normalized geometry', () => {
  const calls = [];
  const context = {
    globalAlpha: 1,
    save() { calls.push(['save']); },
    restore() { calls.push(['restore']); },
    translate(...args) { calls.push(['translate', ...args]); },
    rotate(...args) { calls.push(['rotate', ...args]); },
    scale(...args) { calls.push(['scale', ...args]); },
    drawImage(...args) { calls.push(['drawImage', ...args]); }
  };
  const images = { fox: { naturalWidth: 100, naturalHeight: 200 }, bird: { width: 50, height: 50 } };
  const result = drawCharacterLayers(context, [
    { characterId: 'Foxy', imageUrl: 'fox', x: 0.25, y: 0.5, width: 0.2, height: 0.4, zIndex: 2 },
    { characterId: 'Bird', imageUrl: 'bird', x: 0.75, y: 0.25, width: 0.1, height: 0.2, zIndex: 1, flipX: true }
  ], key => images[key], 1000, 500);
  assert.deepEqual(result, { drawn: 2, skipped: 0 });
  const draws = calls.filter(call => call[0] === 'drawImage');
  assert.equal(draws.length, 2);
  assert.equal(draws[0][1], images.bird);
  assert.deepEqual(draws[0].slice(2), [-50, -50, 100, 100]);
  assert.equal(draws[1][1], images.fox);
  assert.deepEqual(draws[1].slice(2), [-100, -100, 200, 200]);
  assert.ok(calls.some(call => call[0] === 'scale' && call[1] === -1));
});

test('skips hidden layers and assets that are not ready without throwing', () => {
  const calls = [];
  const context = {
    globalAlpha: 1, save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    drawImage(...args) { calls.push(args); }
  };
  const result = drawCharacterLayers(context, [
    { characterId: 'Hidden', imageUrl: 'hidden', visible: false },
    { characterId: 'Loading', imageUrl: 'loading' },
    { characterId: 'Ready', imageUrl: 'ready' }
  ], key => key === 'ready' ? { naturalWidth: 32, naturalHeight: 32 } : null, 640, 360);
  assert.deepEqual(result, { drawn: 1, skipped: 2 });
  assert.equal(calls.length, 1);
});

test('rejects invalid viewport and missing drawing dependencies', () => {
  assert.deepEqual(drawCharacterLayers(null, [], () => null, 100, 100), { drawn: 0, skipped: 0 });
  assert.deepEqual(drawCharacterLayers({}, [{}], () => null, 100, 100), { drawn: 0, skipped: 1 });
  assert.deepEqual(drawCharacterLayers({ drawImage() {} }, [{}], () => null, 0, 100), { drawn: 0, skipped: 1 });
});

test('attaches a generated HTTPS sprite to a new scene layer', async () => {
  const { attachCharacterSpriteToSceneLayers } = await import('../src/scene-character-layers.js');
  const result = attachCharacterSpriteToSceneLayers({}, {
    characterId: 'Foxy', imageUrl: 'https://cdn.example/foxy.png'
  });
  assert.equal(result.status, 'added');
  assert.deepEqual(result.layers[0], {
    characterId: 'Foxy', imageUrl: 'https://cdn.example/foxy.png',
    x: 0.5, y: 0.68, width: 0.28, height: 0.46, rotation: 0,
    scale: 1, opacity: 1, zIndex: 0, flipX: false, visible: true
  });
});

test('updates the existing character sprite while preserving its scene placement', async () => {
  const { attachCharacterSpriteToSceneLayers } = await import('../src/scene-character-layers.js');
  const result = attachCharacterSpriteToSceneLayers({
    characterLayers: [{ characterId: 'Foxy', imageUrl: 'https://cdn.example/old.png', x: 0.22, y: 0.61, scale: 1.4 }]
  }, { characterId: 'foxy', imageUrl: 'https://cdn.example/new.png' });
  assert.equal(result.status, 'updated');
  assert.equal(result.layers.length, 1);
  assert.equal(result.layers[0].imageUrl, 'https://cdn.example/new.png');
  assert.equal(result.layers[0].x, 0.22);
  assert.equal(result.layers[0].y, 0.61);
  assert.equal(result.layers[0].scale, 1.4);
});

test('does not attach invalid sprite URLs or exceed the scene layer limit', async () => {
  const { attachCharacterSpriteToSceneLayers } = await import('../src/scene-character-layers.js');
  assert.equal(attachCharacterSpriteToSceneLayers({}, { characterId: 'Foxy', imageUrl: 'http://cdn.example/fox.png' }).status, 'invalid');
  const characterLayers = Array.from({ length: CHARACTER_LAYER_LIMIT }, (_, index) => ({
    characterId: 'Character ' + index, imageUrl: 'https://cdn.example/' + index + '.png'
  }));
  const result = attachCharacterSpriteToSceneLayers({ characterLayers }, {
    characterId: 'Extra', imageUrl: 'https://cdn.example/extra.png'
  });
  assert.equal(result.status, 'limit-reached');
  assert.equal(result.layers.length, CHARACTER_LAYER_LIMIT);
});

test('draws a complete validated segmented rig with inherited parent bone transforms', () => {
  const calls = [];
  const context = {
    save() { calls.push(['save']); },
    restore() { calls.push(['restore']); },
    translate(...args) { calls.push(['translate', ...args]); },
    rotate(...args) { calls.push(['rotate', ...args]); },
    drawImage(...args) { calls.push(['drawImage', ...args]); }
  };
  const rig = {
    schemaVersion: 1,
    characterId: 'Foxy',
    bones: [
      { id: 'root', parentId: null },
      { id: 'arm', parentId: 'root' }
    ],
    parts: [{
      id: 'left-arm', boneId: 'arm', imageUrl: 'blob:arm',
      x: 0.2, y: 0.3, width: 0.1, height: 0.2, rotation: 0, zIndex: 1
    }]
  };
  const image = { naturalWidth: 40, naturalHeight: 80 };
  const result = drawCharacterRigParts(context, [rig], () => image, 1000, 500, {
    Foxy: { root: { x: 0.05 }, arm: { rotation: 0.25 } }
  });
  assert.deepEqual(result, { drawn: 1, skipped: 0, readyCharacterIds: ['Foxy'] });
  assert.ok(calls.some(call => call[0] === 'translate' && call[1] === 250 && call[2] === 150));
  assert.ok(calls.some(call => call[0] === 'rotate' && call[1] === 0.25));
  assert.ok(calls.some(call => call[0] === 'drawImage' && call[1] === image));
});

test('keeps whole-sprite rendering available when a rig part image is not ready', () => {
  const context = {
    globalAlpha: 1, save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    drawImage() {}
  };
  const rig = {
    schemaVersion: 1, characterId: 'Foxy',
    bones: [{ id: 'root', parentId: null }],
    parts: [{ id: 'body', boneId: 'root', imageUrl: 'blob:missing', x: 0.5, y: 0.5, width: 0.2, height: 0.4 }]
  };
  const result = drawCharacterLayers(context, [
    { characterId: 'Foxy', imageUrl: 'blob:full', x: 0.5, y: 0.5 }
  ], key => key === 'blob:full' ? { naturalWidth: 100, naturalHeight: 100 } : null, 500, 500, {
    drawRigParts: true, characterRigs: [rig]
  });
  assert.equal(result.drawn, 1);
  assert.equal(result.rigDrawn, 0);
  assert.equal(result.rigSkipped, 1);
  assert.deepEqual(result.rigReadyCharacterIds, []);
});

test('can composite ready rig parts alongside legacy character layers when explicitly enabled', () => {
  const calls = [];
  const context = {
    globalAlpha: 1, save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    drawImage(image) { calls.push(image); }
  };
  const rigImage = { naturalWidth: 20, naturalHeight: 20 };
  const spriteImage = { naturalWidth: 100, naturalHeight: 100 };
  const rig = {
    schemaVersion: 1, characterId: 'Foxy',
    bones: [{ id: 'root', parentId: null }],
    parts: [{ id: 'body', boneId: 'root', imageUrl: 'blob:part', x: 0.5, y: 0.5, width: 0.2, height: 0.4 }]
  };
  const result = drawCharacterLayers(context, [
    { characterId: 'Foxy', imageUrl: 'blob:sprite' }
  ], key => key === 'blob:part' ? rigImage : spriteImage, 500, 500, {
    drawRigParts: true, characterRigs: [rig], rigPoses: { Foxy: { root: { y: 0.1 } } }
  });
  assert.equal(result.drawn, 2);
  assert.equal(result.rigDrawn, 1);
  assert.deepEqual(result.rigReadyCharacterIds, ['Foxy']);
  assert.deepEqual(calls, [spriteImage, rigImage]);
});
