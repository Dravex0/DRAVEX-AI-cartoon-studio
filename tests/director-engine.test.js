import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCinematicShot, calculateActionPhase, SHOT_SCALES } from '../src/director-engine.js';

test('opening beat receives an establishing wide shot', () => {
  const shot = calculateCinematicShot({ beatIndex: 0, title: 'Лесная поляна', action: 'Лис осматривает лес' });
  assert.equal(shot.shotScale, SHOT_SCALES.WIDE);
  assert.equal(shot.cameraTransform.zoom, 1);
});

test('Russian inflections for magic select a detail shot', () => {
  const shot = calculateCinematicShot({ beatIndex: 3, title: 'Кульминация', action: 'Яркая вспышка магии озаряет поляну' });
  assert.equal(shot.shotScale, SHOT_SCALES.EXTREME_CU);
  assert.equal(shot.focusTarget, 'prop');
  assert.ok(shot.cameraTransform.zoom > 2);
});

test('legacy motion/action fields remain compatible with canonical visibleAction', () => {
  const legacy = calculateCinematicShot({ title: 'Руна', motion: 'Трещины светятся серебром' });
  const canonical = calculateCinematicShot({ title: 'Руна', visibleAction: 'Трещины светятся серебром' });
  assert.equal(legacy.shotScale, canonical.shotScale);
});

test('extreme wide to extreme close-up is softened', () => {
  const shot = calculateCinematicShot({ beatIndex: 2, action: 'Вспышка магии' }, SHOT_SCALES.EXTREME_WIDE);
  assert.notEqual(shot.shotScale, SHOT_SCALES.EXTREME_CU);
});

test('unknown previous scale does not throw', () => {
  assert.doesNotThrow(() => calculateCinematicShot({ action: 'Aster moves' }, 'UNKNOWN'));
});

test('climax has anticipation, execution, and recovery phases', () => {
  assert.equal(calculateActionPhase(0.5, 'climax').phase, 'anticipation');
  assert.equal(calculateActionPhase(0.75, 'climax').phase, 'execution');
  assert.equal(calculateActionPhase(0.95, 'climax').phase, 'recovery');
});

test('phase progress is clamped and non-finite input is safe', () => {
  assert.equal(calculateActionPhase(-1).phaseWeight, 0);
  assert.equal(calculateActionPhase(2).phase, 'recovery');
  assert.equal(calculateActionPhase(Number.NaN).phase, 'anticipation');
});
