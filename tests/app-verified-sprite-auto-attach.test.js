import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

test('verified generated sprites are attached automatically and trigger motion preparation', () => {
  assert.match(app, /attachVerifiedCharacterSpriteToSceneLayers/);
  assert.match(app, /if\(status==='verified'\)/);
  assert.match(app, /const attached=attachVerifiedCharacterSpriteToSceneLayers\(updatedScene,verifiedAsset\)/);
  assert.match(app, /const motion=prepareAutomaticCharacterMotion\(\)/);
  assert.match(app, /visualIdentityStatus:'not_verified'/);
  assert.match(app, /Character identity is still unverified/);
});

test('unverified or failed sprites are not automatically attached', () => {
  const start = app.indexOf('const updateTransparency=');
  const end = app.indexOf('const verificationImage=', start);
  const block = app.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(block, /if\(status==='verified'\)/);
  assert.ok(!block.includes('attachCharacterSpriteToSceneLayers(updatedScene'));
});
