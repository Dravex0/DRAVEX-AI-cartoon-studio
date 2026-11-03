import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCharacterRigParts } from '../src/character-rig-part-generation.js';

const reference = {
  characterId: 'Foxy',
  appearanceReference: 'Orange fox, cream muzzle, green scarf'
};

test('requires explicit consent before calling the image provider', async () => {
  let calls = 0;
  await assert.rejects(
    generateCharacterRigParts({ ...reference, generateImage: async () => { calls++; } }),
    /Explicit consent/
  );
  assert.equal(calls, 0);
});

test('generates ten separate part assets with one stable identity seed and no auto-approval', async () => {
  const calls = [];
  const result = await generateCharacterRigParts({
    ...reference,
    consentAccepted: true,
    generateImage: async input => {
      calls.push(input);
      return { imageUrl: 'https://images.example.test/' + calls.length + '.png', requestId: 'req-' + calls.length };
    }
  });
  assert.equal(calls.length, 10);
  assert.equal(result.status, 'generated_unverified');
  assert.equal(result.assets.length, 10);
  assert.equal(result.readyForAnimation, false);
  assert.ok(result.assets.every(asset => asset.assetRole === 'character-rig-part'));
  assert.ok(result.assets.every(asset => asset.verificationStatus === 'not_verified'));
  assert.ok(result.assets.every(asset => asset.transparencyStatus === 'unverified'));
  assert.ok(calls.every(call => call.seed === result.identitySeed));
  assert.equal(new Set(result.assets.map(asset => asset.partId)).size, 10);
});

test('keeps successful parts when an individual generation fails', async () => {
  let calls = 0;
  const result = await generateCharacterRigParts({
    ...reference,
    consentAccepted: true,
    generateImage: async () => {
      calls++;
      if (calls === 3) throw new Error('worker unavailable');
      return { imageUrl: 'https://images.example.test/' + calls + '.png' };
    }
  });
  assert.equal(result.status, 'partially_generated');
  assert.equal(result.assets.length, 9);
  assert.deepEqual(result.failures.map(item => item.partId), ['arm-left-upper']);
  assert.equal(result.readyForAnimation, false);
});

test('rejects unsupported image URLs and blocks incomplete character references', async () => {
  const invalid = await generateCharacterRigParts({
    ...reference,
    consentAccepted: true,
    generateImage: async () => ({ imageUrl: 'data:image/png;base64,AA==' })
  });
  assert.equal(invalid.status, 'failed');
  assert.equal(invalid.assets.length, 0);
  assert.equal(invalid.failures.length, 10);
  await assert.rejects(
    generateCharacterRigParts({ characterId: 'Foxy', consentAccepted: true }),
    /canonical appearance reference/
  );
});

test('propagates cancellation instead of silently continuing', async () => {
  const controller = new AbortController();
  await assert.rejects(
    generateCharacterRigParts({
      ...reference,
      consentAccepted: true,
      signal: controller.signal,
      generateImage: async () => {
        controller.abort();
        throw new DOMException('Cancelled', 'AbortError');
      }
    }),
    error => error?.name === 'AbortError'
  );
});


test("keeps completed rig-part images when generation is cancelled", async () => {
  const controller = new AbortController();
  let calls = 0;
  const result = await generateCharacterRigParts({
    characterId: "Foxy",
    appearanceReference: "Small orange fox with a cream muzzle and blue scarf",
    consentAccepted: true,
    signal: controller.signal,
    generateImage: async () => {
      calls += 1;
      controller.abort();
      return { imageUrl: "https://images.example.test/torso.png", requestId: "first-part" };
    }
  });

  assert.equal(calls, 1);
  assert.equal(result.status, "cancelled");
  assert.equal(result.cancelled, true);
  assert.equal(result.assets.length, 1);
  assert.equal(result.assets[0].partId, "torso");
  assert.equal(result.readyForAnimation, false);
});
