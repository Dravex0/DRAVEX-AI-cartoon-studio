import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCharacterRig, normalizeCharacterRigPoses, validateCharacterRig, applyCharacterRigPose, characterRigPosesFor } from '../src/character-rig.js';
import { normalizeScene } from '../src/scene-model.js';

const validRig = () => ({
  schemaVersion: 1,
  characterId: 'fox',
  bones: [
    { id: 'root', parentId: null, pivotX: 0.5, pivotY: 0.5 },
    { id: 'arm', parentId: 'root', pivotX: 0.2, pivotY: 0.3 }
  ],
  parts: [{ id: 'arm-left', boneId: 'arm', imageUrl: 'https://cdn.example.test/arm.png', x: 0.1, y: 0.2, width: 0.2, height: 0.3 }]
});

describe('character rig foundation', () => {
  it('normalizes bounded rig metadata without changing whole-sprite assets', () => {
    const rig = normalizeCharacterRig(validRig());
    assert.equal(rig.characterId, 'fox');
    assert.equal(rig.bones.length, 2);
    assert.equal(rig.parts[0].imageUrl, 'https://cdn.example.test/arm.png');
    assert.equal(normalizeScene({ characterLayers: [{ characterId: 'fox', imageUrl: 'https://cdn.example.test/full.png' }] }).characterLayers.length, 1);
  });

  it('accepts a connected single-root rig with HTTPS image parts', () => {
    assert.equal(validateCharacterRig(validRig()).status, 'valid');
  });

  it('rejects missing parent links, duplicate IDs, and cycles', () => {
    const rig = validRig();
    rig.bones[1].parentId = 'missing';
    assert.ok(validateCharacterRig(rig).issues.some(issue => issue.code === 'bone-parent-missing'));
    rig.bones[1].parentId = 'root';
    rig.bones.push({ id: 'ROOT', parentId: 'arm' });
    assert.ok(validateCharacterRig(rig).issues.some(issue => issue.code === 'bone-id-duplicate'));
    assert.ok(validateCharacterRig(rig).issues.some(issue => issue.code === 'bone-cycle'));
  });

  it('rejects unsafe remote protocols and parts without a matching bone', () => {
    const rig = validRig();
    rig.parts[0].imageUrl = 'javascript:alert(1)';
    rig.parts[0].boneId = 'unknown';
    const codes = validateCharacterRig(rig).issues.map(issue => issue.code);
    assert.ok(codes.includes('part-image-invalid'));
    assert.ok(codes.includes('part-bone-missing'));
  });

  it('inherits parent bone offsets and rotations for child parts', () => {
    const rig = validRig();
    const [part] = rig.parts;
    const moved = applyCharacterRigPose([part], rig, {
      root: { x: 0.05, rotation: 0.1 },
      arm: { x: 0.15, y: -0.1, rotation: 0.25 }
    });
    assert.ok(Math.abs(moved[0].x - 0.3) < 1e-9);
    assert.ok(Math.abs(moved[0].y - 0.1) < 1e-9);
    assert.ok(Math.abs(moved[0].rotation - 0.35) < 1e-9);
  });

  it('matches bone pose keys without depending on character ID casing', () => {
    const rig = validRig();
    const [part] = rig.parts;
    const moved = applyCharacterRigPose([part], rig, {
      ROOT: { x: 0.05, rotation: 0.1 },
      ARM: { x: 0.15, y: -0.1, rotation: 0.25 }
    });
    assert.ok(Math.abs(moved[0].x - 0.3) < 1e-9);
    assert.ok(Math.abs(moved[0].y - 0.1) < 1e-9);
    assert.ok(Math.abs(moved[0].rotation - 0.35) < 1e-9);
  });

  it('prefers an exact bone pose key when case variants are both present', () => {
    const rig = validRig();
    const [part] = rig.parts;
    const moved = applyCharacterRigPose([part], rig, {
      arm: { x: 0.1 },
      ARM: { x: 0.8 }
    });
    assert.equal(moved[0].x, 0.2);
  });


  it('resolves saved character rig poses case-insensitively with exact-key precedence', () => {
    const lowerCase = { root: { x: 0.25 } };
    const upperCase = { root: { x: 0.75 } };
    assert.equal(characterRigPosesFor('Foxy', { foxy: lowerCase }), lowerCase);
    assert.equal(characterRigPosesFor('Foxy', { foxy: lowerCase, Foxy: upperCase }), upperCase);
    assert.deepEqual(characterRigPosesFor('Missing', { foxy: lowerCase }), {});
    assert.deepEqual(characterRigPosesFor('Foxy', null), {});
  });

  it('normalizes bounded per-scene rig poses and preserves them through scene normalization', () => {
    const poses = normalizeCharacterRigPoses({
      Foxy: { root: { x: 9, y: -9, rotation: 99, invalid: 2 } },
      ignored: null
    });
    assert.deepEqual(poses, { Foxy: { root: { x: 2, y: -2, rotation: Math.PI * 2 } } });
    const scene = normalizeScene({ characterRigPoses: { Foxy: { root: { x: 0.2, y: 0.1 } } } });
    assert.deepEqual(scene.characterRigPoses, { Foxy: { root: { x: 0.2, y: 0.1 } } });
  });

  it('applies only explicit finite bone pose deltas and safely preserves invalid rigs', () => {
    const rig = validRig();
    const [part] = rig.parts;
    const moved = applyCharacterRigPose([part], rig, { arm: { x: 0.15, y: -0.1, rotation: 0.25 } });
    assert.equal(moved[0].x, 0.25);
    assert.equal(moved[0].y, 0.1);
    assert.equal(moved[0].rotation, 0.25);
    const unchanged = applyCharacterRigPose([part], { ...rig, bones: [] }, { arm: { x: 1 } });
    assert.equal(unchanged[0].x, part.x);
  });
});
