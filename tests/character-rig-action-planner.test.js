import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterRigTimelineFromActionTimeline } from '../src/character-rig-action-planner.js';
import { sampleCharacterRigTimeline } from '../src/character-rig-timeline.js';
import { solveCharacterRigLimbPose } from '../src/character-rig-ik.js';

const rig = (characterId = 'Foxy') => ({
  schemaVersion: 1,
  characterId,
  bones: [
    { id: 'root', parentId: null },
    { id: 'leftArm', parentId: 'root' },
    { id: 'rightArm', parentId: 'root' },
    { id: 'leftLeg', parentId: 'root' },
    { id: 'rightLeg', parentId: 'root' },
    { id: 'head', parentId: 'root' }
  ],
  parts: [
    { id: 'body', boneId: 'root', imageUrl: 'https://assets.example/body.png' },
    { id: 'arm-l', boneId: 'leftArm', imageUrl: 'https://assets.example/arm-l.png' },
    { id: 'arm-r', boneId: 'rightArm', imageUrl: 'https://assets.example/arm-r.png' },
    { id: 'leg-l', boneId: 'leftLeg', imageUrl: 'https://assets.example/leg-l.png' },
    { id: 'leg-r', boneId: 'rightLeg', imageUrl: 'https://assets.example/leg-r.png' },
    { id: 'head-part', boneId: 'head', imageUrl: 'https://assets.example/head.png' }
  ]
});
const makeScene = description => ({
  characters: ['Foxy'],
  characterCastProvided: true,
  storyDetail: 'Foxy ' + description,
  actionTimeline: {
    schemaVersion: 1,
    phases: [{
      phase: 'action', start: 0.2, end: 0.8, actorId: 'Foxy',
      targetId: null, description: 'Foxy ' + description,
      evidence: 'Foxy ' + description
    }]
  }
});

test('maps grounded dodge action into an articulated rig timeline in scene time', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('dodges the incoming strike'), [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.generatedCount, 1);
  assert.equal(result.mappedActions[0].preset, 'dodge');
  const middle = sampleCharacterRigTimeline(result.timeline, 0.5).Foxy;
  assert.ok(Math.abs(middle.leftArm.rotation) > 0.5);
  assert.ok(Math.abs(middle.rightArm.rotation) > 0.5);
  assert.equal(result.timeline.keyframes[0].time, 0);
  assert.equal(result.timeline.keyframes.at(-1).time, 1);
});

test('maps jump action and preserves neutral poses outside its scene-time interval', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('jumps over the stone'), [rig()]);
  assert.equal(result.status, 'generated');
  const before = sampleCharacterRigTimeline(result.timeline, 0.1).Foxy || {};
  const middle = sampleCharacterRigTimeline(result.timeline, 0.35).Foxy;
  assert.equal(before.root?.y || 0, 0);
  assert.ok(Math.abs(middle.root.y) > 0);
});

test('does not guess a rig preset for unsupported semantic actions', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('opens a mysterious chest'), [rig()]);
  assert.equal(result.status, 'no-supported-actions');
  assert.equal(result.timeline, null);
  assert.equal(result.skipped[0].reason, 'unsupported-or-ambiguous-action');
});

test('blocks invalid action timelines before generating rig poses', () => {
  const scene = makeScene('dodges the incoming strike');
  scene.actionTimeline.phases[0].evidence = 'invented evidence';
  const result = createCharacterRigTimelineFromActionTimeline(scene, [rig()]);
  assert.equal(result.status, 'blocked');
  assert.equal(result.timeline, null);
});


test('combines grounded actions for multiple characters on one scene clock', () => {
  const scene = {
    characters: ['Foxy', 'Bunny'],
    characterCastProvided: true,
    storyDetail: 'Foxy walks to the gate. Bunny jumps over the stone. Foxy runs away. Bunny walks to Foxy.',
    actionTimeline: {
      schemaVersion: 1,
      phases: [
        { phase: 'preparation', start: 0.05, end: 0.2, actorId: 'Foxy', targetId: null, description: 'Foxy walks to the gate', evidence: 'Foxy walks to the gate.' },
        { phase: 'action', start: 0.25, end: 0.5, actorId: 'Bunny', targetId: null, description: 'Bunny jumps over the stone', evidence: 'Bunny jumps over the stone.' },
        { phase: 'reaction', start: 0.55, end: 0.7, actorId: 'Foxy', targetId: null, description: 'Foxy runs away', evidence: 'Foxy runs away.' },
        { phase: 'result', start: 0.75, end: 0.9, actorId: 'Bunny', targetId: null, description: 'Bunny walks to Foxy', evidence: 'Bunny walks to Foxy.' }
      ]
    }
  };
  const result = createCharacterRigTimelineFromActionTimeline(scene, [rig('Foxy'), rig('Bunny')]);
  assert.equal(result.status, 'generated');
  assert.equal(result.generatedCount, 4);
  assert.deepEqual(result.mappedActions.map(item => item.actorId).sort(), ['Bunny', 'Bunny', 'Foxy', 'Foxy']);
  assert.ok(sampleCharacterRigTimeline(result.timeline, 0.35).Bunny);
  assert.ok(sampleCharacterRigTimeline(result.timeline, 0.6).Foxy);
});

test('reports supported story actions whose actor has no attached rig', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('jumps over the stone'), [rig('Bunny')]);
  assert.equal(result.status, 'no-supported-actions');
  assert.equal(result.timeline, null);
  assert.equal(result.skipped[0].reason, 'actor-rig-missing');
});


test('maps an explicit English greeting wave to the articulated wave preset', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('waves hello to the traveler'), [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].preset, 'wave');
  const middle = sampleCharacterRigTimeline(result.timeline, 0.5).Foxy;
  assert.ok(Math.abs(middle.rightArm.rotation) > 0.5);
});

test('maps an explicit Russian hand wave to the articulated wave preset', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('машет рукой путнику'), [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].preset, 'wave');
  const middle = sampleCharacterRigTimeline(result.timeline, 0.5).Foxy;
  assert.ok(Math.abs(middle.rightArm.rotation) > 0.5);
});

test('maps an explicit Spanish hand wave to the articulated wave preset', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('saluda con la mano al viajero'), [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].preset, 'wave');
  const middle = sampleCharacterRigTimeline(result.timeline, 0.5).Foxy;
  assert.ok(Math.abs(middle.rightArm.rotation) > 0.5);
});

test('maps grounded attack actions to a visible articulated strike', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('attacks the stone golem'), [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].preset, 'attack');
  const middle = sampleCharacterRigTimeline(result.timeline, 0.5).Foxy;
  assert.ok(middle.root.x > 0);
  assert.ok(Math.abs(middle.rightArm.rotation) > 0.8);
});

test('maps grounded defense actions to an articulated protective brace', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('raises a shield and protects the village'), [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].preset, 'defend');
  const middle = sampleCharacterRigTimeline(result.timeline, 0.5).Foxy;
  assert.ok(middle.root.y > 0);
  assert.ok(Math.abs(middle.leftArm.rotation) > 0.4);
  assert.ok(Math.abs(middle.rightArm.rotation) > 0.4);
});

test('maps grounded English dance action to a looping articulated full-body groove', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('dances to the music'), [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].preset, 'dance');
  const start = sampleCharacterRigTimeline(result.timeline, 0.2).Foxy || {};
  const middle = sampleCharacterRigTimeline(result.timeline, 0.5).Foxy;
  const end = sampleCharacterRigTimeline(result.timeline, 0.8).Foxy || {};
  assert.ok(Math.abs(middle.leftArm.rotation) > 0.2);
  assert.ok(Math.abs(middle.rightArm.rotation) > 0.2);
  assert.equal(start.root?.y || 0, end.root?.y || 0);
});

test('maps grounded Ukrainian dance action to the dance preset', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('танцює під музику'), [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].preset, 'dance');
});

test('maps grounded dialogue phases through the Doodle adapter to idle body motion', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('whispers a warning to the traveler'), [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.generatedCount, 1);
  assert.equal(result.mappedActions[0].doodleAction, 'talk');
  assert.equal(result.mappedActions[0].preset, 'idle');
  assert.ok(sampleCharacterRigTimeline(result.timeline, 0.35).Foxy);
});

test('maps explicit fear reactions through the Doodle adapter to the existing defend rig preset', () => {
  const result = createCharacterRigTimelineFromActionTimeline(makeScene('is scared by the sudden thunder'), [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].doodleAction, 'scared');
  assert.equal(result.mappedActions[0].preset, 'defend');
  const middle = sampleCharacterRigTimeline(result.timeline, 0.5).Foxy;
  assert.ok(Math.abs(middle.leftArm.rotation) > 0.4);
  assert.ok(Math.abs(middle.rightArm.rotation) > 0.4);
});


test('compiles supported ordered walk and run substeps into separate rig segments', () => {
  const scene = makeScene('walks slowly, then runs toward the door');
  scene.actionTimeline.phases[0].steps = [
    { intent: 'stealth_advance', motionCue: 'walk', start: 0.2, end: 0.48, actorId: 'Foxy', description: 'Walk slowly', evidence: 'walks slowly' },
    { intent: 'intervene', motionCue: 'run', start: 0.48, end: 0.8, actorId: 'Foxy', description: 'Run toward the door', evidence: 'runs toward the door' }
  ];
  const result = createCharacterRigTimelineFromActionTimeline(scene, [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.generatedCount, 2);
  assert.deepEqual(result.mappedActions.map(item => item.preset), ['walk', 'run']);
  assert.deepEqual(result.mappedActions.map(item => [item.start, item.end]), [[0.2, 0.48], [0.48, 0.8]]);
});


test('maps distinct tactical intents to dedicated rig poses instead of generic turn cues', () => {
  const story = 'Foxy listens carefully, draws a weapon, aims, raises both hands, takes cover, drops the weapon, and freezes.';
  const scene = {
    characters: ['Foxy'],
    characterCastProvided: true,
    storyDetail: story,
    actionTimeline: {
      schemaVersion: 1,
      phases: [{
        phase: 'action', start: 0, end: 1, actorId: 'Foxy',
        description: story, evidence: story,
        steps: [
          { intent: 'listen_carefully', motionCue: 'turn', start: 0, end: 0.14, actorId: 'Foxy', description: 'Listen carefully', evidence: 'listens carefully' },
          { intent: 'draw_weapon', motionCue: 'turn', start: 0.14, end: 0.28, actorId: 'Foxy', description: 'Draw a weapon', evidence: 'draws a weapon' },
          { intent: 'aim_weapon', motionCue: 'turn', start: 0.28, end: 0.42, actorId: 'Foxy', description: 'Aim the weapon', evidence: 'aims' },
          { intent: 'hands_up', motionCue: 'surprised', start: 0.42, end: 0.56, actorId: 'Foxy', description: 'Raise both hands', evidence: 'raises both hands' },
          { intent: 'take_cover', motionCue: 'jump', start: 0.56, end: 0.7, actorId: 'Foxy', description: 'Take cover', evidence: 'takes cover' },
          { intent: 'drop_weapon', motionCue: 'turn', start: 0.7, end: 0.84, actorId: 'Foxy', description: 'Drop the weapon', evidence: 'drops the weapon' },
          { intent: 'freeze', motionCue: 'idle', start: 0.84, end: 1, actorId: 'Foxy', description: 'Freeze in place', evidence: 'freezes' }
        ]
      }]
    }
  };
  const result = createCharacterRigTimelineFromActionTimeline(scene, [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(result.generatedCount, 7);
  assert.deepEqual(result.mappedActions.map(item => item.preset), [
    'listen', 'draw_weapon', 'aim_weapon', 'hands_up', 'take_cover', 'drop_weapon', 'freeze'
  ]);
});


test('maps grounded object handling and social interaction intents to dedicated articulated poses', () => {
  const actions = [
    ['pick_up', 'Pick up the stone', 'pick_up'],
    ['grasp', 'Grasp the handle', 'grasp'],
    ['release', 'Release the handle', 'release'],
    ['carry', 'Carry the box', 'carry'],
    ['throw', 'Throw the ball', 'throw'],
    ['catch', 'Catch the ball', 'catch'],
    ['push', 'Push the cart', 'push'],
    ['pull', 'Pull the rope', 'pull'],
    ['hug', 'Hug the traveler', 'hug'],
    ['point', 'Point toward the door', 'point'],
    ['sit', 'Sit on the bench', 'sit']
  ];
  for (const [intent, description, expectedPreset] of actions) {
    const scene = makeScene(description);
    scene.actionTimeline.phases[0].steps = [{
      intent, motionCue: 'turn', start: 0.2, end: 0.8, actorId: 'Foxy',
      description, evidence: description
    }];
    const result = createCharacterRigTimelineFromActionTimeline(scene, [rig()]);
    assert.equal(result.status, 'generated', intent);
    assert.equal(result.mappedActions[0].preset, expectedPreset, intent);
    const pose = sampleCharacterRigTimeline(result.timeline, 0.5).Foxy;
    assert.ok(pose && Object.values(pose).some(bonePose =>
      Math.abs(bonePose.x || 0) > 0.01 || Math.abs(bonePose.y || 0) > 0.01
      || Math.abs(bonePose.rotation || 0) > 0.08
    ), intent);
  }
});

test('keeps object-interaction poses deterministic for rigs with different character IDs', () => {
  const scene = makeScene('throws the ball');
  scene.actionTimeline.phases[0].steps = [{
    intent: 'throw', motionCue: 'run', start: 0.2, end: 0.8,
    actorId: 'Foxy', description: 'throws the ball', evidence: 'throws the ball'
  }];
  const first = createCharacterRigTimelineFromActionTimeline(scene, [rig('Foxy')]);
  const second = createCharacterRigTimelineFromActionTimeline({
    ...scene,
    characters: ['Mira'],
    storyDetail: 'Mira throws the ball',
    actionTimeline: { schemaVersion: 1, phases: [{
      ...scene.actionTimeline.phases[0], actorId: 'Mira',
      description: 'Mira throws the ball', evidence: 'Mira throws the ball',
      steps: scene.actionTimeline.phases[0].steps.map(step => ({
        ...step, actorId: 'Mira', description: 'Mira throws the ball', evidence: 'Mira throws the ball'
      }))
    }] }
  }, [rig('Mira')]);
  assert.equal(first.status, 'generated');
  assert.equal(second.status, 'generated');
  assert.deepEqual(
    sampleCharacterRigTimeline(first.timeline, 0.5).Foxy,
    sampleCharacterRigTimeline(second.timeline, 0.5).Mira
  );
});


test('uses an explicit target position to solve and animate a reachable character arm', () => {
  const targetPosition = { x: 0.72, y: 0.55 };
  const armRig = {
    schemaVersion: 1,
    characterId: 'Foxy',
    bones: [
      { id: 'root', parentId: null },
      { id: 'leftArm', parentId: 'root', pivotX: 0.5, pivotY: 0.4 },
      { id: 'leftForearm', parentId: 'leftArm', pivotX: 0.65, pivotY: 0.4 },
      { id: 'leftHand', parentId: 'leftForearm', pivotX: 0.8, pivotY: 0.4 }
    ],
    parts: [
      { id: 'body', boneId: 'root', imageUrl: 'https://assets.example/body.png', x: 0.5, y: 0.5 },
      { id: 'hand', boneId: 'leftHand', imageUrl: 'https://assets.example/hand.png', x: 0.8, y: 0.4 }
    ]
  };
  const expected = solveCharacterRigLimbPose(armRig, {
    upperBoneId: 'leftArm', lowerBoneId: 'leftForearm', endBoneId: 'leftHand',
    target: targetPosition
  });
  assert.equal(expected.status, 'solved');
  assert.equal(expected.reachable, true);

  const scene = makeScene('picks up the silver key');
  scene.actionTimeline.phases[0].steps = [{
    intent: 'pick_up', motionCue: 'turn', start: 0.2, end: 0.8,
    actorId: 'Foxy', targetId: 'silver key', targetPosition,
    description: 'Foxy picks up the silver key', evidence: 'picks up the silver key'
  }];
  const result = createCharacterRigTimelineFromActionTimeline(scene, [armRig]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].targetedReach, 'solved');
  const endPose = sampleCharacterRigTimeline(result.timeline, 0.8).Foxy;
  assert.ok(Math.abs(endPose.leftArm.rotation - expected.pose.leftArm.rotation) < 1e-6);
  assert.ok(Math.abs(endPose.leftForearm.rotation - expected.pose.leftForearm.rotation) < 1e-6);
});

test('does not invent a target or apply IK when an action has only a target ID', () => {
  const scene = makeScene('picks up the silver key');
  scene.actionTimeline.phases[0].steps = [{
    intent: 'pick_up', motionCue: 'turn', start: 0.2, end: 0.8,
    actorId: 'Foxy', targetId: 'silver key',
    description: 'Foxy picks up the silver key', evidence: 'picks up the silver key'
  }];
  const result = createCharacterRigTimelineFromActionTimeline(scene, [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(Object.hasOwn(result.mappedActions[0], 'targetedReach'), false);
});


test('resolves an IK target from the uniquely matching explicitly positioned prop state change', () => {
  const targetPosition = { x: 0.72, y: 0.55 };
  const armRig = {
    schemaVersion: 1,
    characterId: 'Foxy',
    bones: [
      { id: 'root', parentId: null },
      { id: 'leftArm', parentId: 'root', pivotX: 0.5, pivotY: 0.4 },
      { id: 'leftForearm', parentId: 'leftArm', pivotX: 0.65, pivotY: 0.4 },
      { id: 'leftHand', parentId: 'leftForearm', pivotX: 0.8, pivotY: 0.4 }
    ],
    parts: [
      { id: 'body', boneId: 'root', imageUrl: 'https://assets.example/body.png', x: 0.5, y: 0.5 },
      { id: 'hand', boneId: 'leftHand', imageUrl: 'https://assets.example/hand.png', x: 0.8, y: 0.4 }
    ]
  };
  const candidate = makeScene('picks up the silver key');
  candidate.stateChanges = [{
    entityType: 'prop', entityId: 'silver key', property: 'holder',
    previousValue: null, value: 'Foxy', actionIntent: 'pick_up',
    position: targetPosition, evidence: 'Foxy picks up the silver key'
  }];
  candidate.actionTimeline.phases[0].steps = [{
    intent: 'pick_up', motionCue: 'turn', start: 0.2, end: 0.8,
    actorId: 'Foxy', targetId: 'silver key',
    description: 'Foxy picks up the silver key', evidence: 'picks up the silver key'
  }];
  const result = createCharacterRigTimelineFromActionTimeline(candidate, [armRig]);
  assert.equal(result.status, 'generated');
  assert.equal(result.mappedActions[0].targetedReach, 'solved');
  assert.equal(result.mappedActions[0].targetPositionSource, 'prop-state-change');
});

test('does not resolve an ambiguous prop target from multiple unmatched position records', () => {
  const candidate = makeScene('picks up the silver key');
  candidate.stateChanges = [
    { entityType: 'prop', entityId: 'silver key', property: 'holder', position: { x: 0.72, y: 0.55 } },
    { entityType: 'prop', entityId: 'silver key', property: 'holder', position: { x: 0.2, y: 0.3 } }
  ];
  candidate.actionTimeline.phases[0].steps = [{
    intent: 'pick_up', motionCue: 'turn', start: 0.2, end: 0.8,
    actorId: 'Foxy', targetId: 'silver key',
    description: 'Foxy picks up the silver key', evidence: 'picks up the silver key'
  }];
  const result = createCharacterRigTimelineFromActionTimeline(candidate, [rig()]);
  assert.equal(result.status, 'generated');
  assert.equal(Object.hasOwn(result.mappedActions[0], 'targetedReach'), false);
});


test('maps 17 additional semantic scene actions to dedicated articulated rig presets', () => {
  const cases = [
    ['chases Bird through the forest', 'run'],
    ['rescues Bird from the river', 'run'],
    ['climbs the ladder', 'climb'],
    ['swims across the river', 'swim'],
    ['crawls under the table', 'crawl'],
    ['falls from the platform', 'fall'],
    ['lands on the ground', 'land'],
    ['opens the door', 'open'],
    ['closes the door', 'close'],
    ['drinks from the bottle', 'eat_drink'],
    ['wakes up from sleep', 'sleep_wake'],
    ['draws a map', 'write_draw'],
    ['powers up as energy surges around the hands', 'power_up'],
    ['combines powers with Bird', 'team_magic'],
    ['their energy collides in a powerful clash', 'energy_clash'],
    ['restrains Bird', 'restrain'],
    ['appears from the shadows', 'reveal']
  ];
  for (const [description, expectedPreset] of cases) {
    const result = createCharacterRigTimelineFromActionTimeline(makeScene(description), [rig()]);
    assert.equal(result.status, 'generated', description);
    assert.equal(result.mappedActions[0].preset, expectedPreset, description);
    assert.ok(sampleCharacterRigTimeline(result.timeline, 0.5).Foxy, description);
  }
});
