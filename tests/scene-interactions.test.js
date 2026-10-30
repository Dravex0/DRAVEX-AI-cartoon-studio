import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSceneInteraction, validateSceneInteractions, sampleInteractionProgress } from '../src/scene-interactions.js';

test('normalizes interaction participants and scene-local timing', () => {
  const event = normalizeSceneInteraction({ type: 'talk_to', participants: ['fox', 'owl', 'fox'], start: 1, end: 2 }, 0, 4);
  assert.deepEqual(event.participants, ['fox', 'owl']);
  assert.equal(event.startSeconds, 1);
  assert.equal(event.endSeconds, 2);
  assert.equal(event.type, 'talk_to');
});

test('clamps interaction timing to scene bounds and provides stable IDs', () => {
  const event = normalizeSceneInteraction({ type: 'give_object', start: -5, end: 99 }, 2, 3);
  assert.equal(event.id, 'interaction_3');
  assert.equal(event.startSeconds, 0);
  assert.equal(event.endSeconds, 3);
});

test('validates two-character interactions against stable scene character IDs', () => {
  const event = normalizeSceneInteraction({ id: 'exchange', type: 'give_object', participants: ['fox', 'owl'], objectId: 'key', start: 0.5, end: 2 }, 0, 3);
  assert.deepEqual(validateSceneInteractions([event], ['fox', 'owl'], 3), { valid: true, issues: [] });
});

test('reports missing participants, unknown IDs, duplicate IDs and invalid timing', () => {
  const events = [
    { id: 'bad', type: 'talk_to', participants: ['fox'], startSeconds: 2, endSeconds: 1 },
    { id: 'bad', type: 'look_at', participants: ['ghost', 'owl'], startSeconds: 0, endSeconds: 4 }
  ];
  const result = validateSceneInteractions(events, ['fox', 'owl'], 3);
  const codes = result.issues.map(issue => issue.code);
  assert.ok(codes.includes('MISSING_SECOND_PARTICIPANT'));
  assert.ok(codes.includes('UNKNOWN_CHARACTER'));
  assert.ok(codes.includes('DUPLICATE_ID'));
  assert.ok(codes.includes('INVALID_TIMING'));
});

test('interaction progress eases in and out within the event interval', () => {
  const event = { startSeconds: 1, endSeconds: 3 };
  assert.equal(sampleInteractionProgress(event, 1), 0);
  assert.equal(sampleInteractionProgress(event, 2), 0.5);
  assert.equal(sampleInteractionProgress(event, 3), 0);
  assert.equal(sampleInteractionProgress(event, 0), 0);
});

test('malformed events and non-finite progress fail safely', () => {
  assert.equal(validateSceneInteractions([null], [], 3).valid, false);
  assert.equal(sampleInteractionProgress({ startSeconds: 1, endSeconds: 2 }, Number.NaN), 0);
});
