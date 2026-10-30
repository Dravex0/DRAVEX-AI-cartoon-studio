import test from 'node:test';
import assert from 'node:assert/strict';
import { getSceneCharacterLayout, getSceneObjectHandoffs, getSceneCharacterGesturePose } from '../src/character-layout.js';

test('stages two or more stable character IDs at distinct positions', () => {
  const layout = getSceneCharacterLayout({ characters: ['Ryzhik', 'Snowball', 'Owl'] }, 0);
  assert.deepEqual(layout.map(item => item.characterId), ['Ryzhik', 'Snowball', 'Owl']);
  assert.equal(new Set(layout.map(item => item.x)).size, 3);
  assert.ok(layout.every(item => item.x >= 0.12 && item.x <= 0.88));
});

test('single-character scenes keep the existing centered composition', () => {
  const [fox] = getSceneCharacterLayout({ characters: ['Ryzhik'] });
  assert.equal(fox.x, 0.5);
  assert.equal(fox.facing, 1);
});

test('dialogue turns characters toward each other and establishes gaze targets', () => {
  const layout = getSceneCharacterLayout({
    characters: ['Ryzhik', 'Snowball'],
    interactions: [{ type: 'talk_to', participants: ['Ryzhik', 'Snowball'], startSeconds: 1, endSeconds: 3 }]
  }, 2);
  assert.equal(layout[0].facing, 1);
  assert.equal(layout[1].facing, -1);
  assert.equal(layout[0].gazeTargetCharacterId, 'Snowball');
  assert.equal(layout[1].gazeTargetCharacterId, 'Ryzhik');
  assert.equal(layout[0].interaction, 'talk_to');
});

test('approach gradually closes character spacing and ignores inactive events', () => {
  const scene = { characters: ['A', 'B'], interactions: [{ type: 'approach', participants: ['A', 'B'], startSeconds: 0, endSeconds: 2 }] };
  const start = getSceneCharacterLayout(scene, 0);
  const middle = getSceneCharacterLayout(scene, 1);
  assert.ok(Math.abs(middle[1].x - middle[0].x) < Math.abs(start[1].x - start[0].x));
  const before = getSceneCharacterLayout(scene, 3.1);
  assert.equal(before[0].interaction, '');
});

test('malformed scene input fails safely and caps layout size', () => {
  assert.deepEqual(getSceneCharacterLayout(null), []);
  const layout = getSceneCharacterLayout({ characters: Array.from({ length: 12 }, (_, i) => 'C' + i) });
  assert.equal(layout.length, 8);
  assert.ok(layout.every(item => Number.isFinite(item.x)));
});


test('approach eases back to the original staging after the event ends', () => {
  const scene = { characters: ['A', 'B'], interactions: [{ type: 'approach', participants: ['A', 'B'], startSeconds: 1, endSeconds: 3 }] };
  const before = getSceneCharacterLayout(scene, 0.5);
  const during = getSceneCharacterLayout(scene, 2);
  const after = getSceneCharacterLayout(scene, 3.5);
  const distance = layout => Math.abs(layout[1].x - layout[0].x);
  assert.ok(distance(during) < distance(before));
  assert.equal(distance(after), distance(before));
});

test('give-object staging eases in and returns characters to baseline', () => {
  const scene = { characters: ['A', 'B'], interactions: [{ type: 'give_object', participants: ['A', 'B'], objectId: 'letter', startSeconds: 1, endSeconds: 3 }] };
  const before = getSceneCharacterLayout(scene, 0.5);
  const during = getSceneCharacterLayout(scene, 2);
  const after = getSceneCharacterLayout(scene, 3.5);
  assert.ok(during[0].x > before[0].x);
  assert.equal(after[0].x, before[0].x);
});


test('object hand-off moves an explicitly described prop from giver to receiver', () => {
  const scene = { characters: ['A', 'B'], interactions: [{ id: 'pass-key', type: 'give_object', participants: ['A', 'B'], objectId: 'key-1', objectDescription: 'silver key', startSeconds: 1, endSeconds: 3 }] };
  const start = getSceneObjectHandoffs(scene, 1)[0];
  const middle = getSceneObjectHandoffs(scene, 2)[0];
  const end = getSceneObjectHandoffs(scene, 3)[0];
  assert.equal(start.label, 'silver key');
  assert.equal(start.progress, 0);
  assert.equal(middle.progress, 0.5);
  assert.equal(end.progress, 1);
  assert.ok(start.x < middle.x && middle.x < end.x);
  assert.equal(middle.giverId, 'A');
  assert.equal(middle.receiverId, 'B');
});

test('does not invent a visible prop when an exchange has no explicit object description', () => {
  const scene = { characters: ['A', 'B'], interactions: [{ type: 'give_object', participants: ['A', 'B'], objectId: 'unknown', startSeconds: 0, endSeconds: 2 }] };
  assert.deepEqual(getSceneObjectHandoffs(scene, 1), []);
});


test('handoff gestures extend the giver arm and animate the receiver reach later', () => {
  const scene = { characters: ['A', 'B'], interactions: [{ type: 'give_object', participants: ['A', 'B'], startSeconds: 0, endSeconds: 2 }] };
  const giver = getSceneCharacterGesturePose(scene, 1, 'A');
  const receiverEarly = getSceneCharacterGesturePose(scene, 0.5, 'B');
  const receiverLate = getSceneCharacterGesturePose(scene, 1.8, 'B');
  assert.equal(giver.active, true);
  assert.ok(giver.rightArm > 35);
  assert.equal(receiverEarly.rightArm, 0);
  assert.ok(receiverLate.rightArm > receiverEarly.rightArm);
});

test('reaction gesture raises both arms and inactive or unknown actors stay neutral', () => {
  const scene = { characters: ['A', 'B'], interactions: [{ type: 'react_to', participants: ['A', 'B'], startSeconds: 1, endSeconds: 3 }] };
  const active = getSceneCharacterGesturePose(scene, 2, 'B');
  const inactive = getSceneCharacterGesturePose(scene, 4, 'B');
  const unknown = getSceneCharacterGesturePose(scene, 2, 'C');
  assert.ok(active.leftArm < 0 && active.rightArm > 0);
  assert.equal(inactive.active, false);
  assert.deepEqual(unknown, { leftArm: 0, rightArm: 0, active: false, interaction: '' });
});

test('malformed gesture input safely returns a neutral pose', () => {
  assert.deepEqual(getSceneCharacterGesturePose(null, NaN, 'A'), { leftArm: 0, rightArm: 0, active: false, interaction: '' });
});


test('handoff arm poses release smoothly at the end of the interaction', () => {
  const scene = { characters: ['A', 'B'], interactions: [{ type: 'give_object', participants: ['A', 'B'], startSeconds: 0, endSeconds: 2 }] };
  const giverNearEnd = getSceneCharacterGesturePose(scene, 1.9, 'A');
  const receiverAtEnd = getSceneCharacterGesturePose(scene, 2, 'B');
  assert.ok(giverNearEnd.rightArm < 15);
  assert.equal(receiverAtEnd.rightArm, 0);
  assert.equal(receiverAtEnd.active, false);
});

test('overlapping interaction cues preserve the strongest arm pose', () => {
  const scene = { characters: ['A', 'B', 'C'], interactions: [
    { type: 'gesture_to', participants: ['A', 'B'], startSeconds: 0, endSeconds: 2 },
    { type: 'give_object', participants: ['A', 'C'], startSeconds: 0, endSeconds: 2 }
  ] };
  const pose = getSceneCharacterGesturePose(scene, 1, 'A');
  assert.equal(pose.rightArm, 82);
  assert.equal(pose.active, true);
});
