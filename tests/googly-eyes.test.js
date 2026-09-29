import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EYE_WHITE_SPANS, GooglyEye } from '../src/vfx/googly-eyes.js';

function assertPupilInsideWhite(eye) {
  for (const [x, y] of eye.pupilPixels()) {
    const span = EYE_WHITE_SPANS[y];
    assert.ok(span && x >= span[0] && x <= span[1], `pupil pixel ${x},${y} is outside the eye white`);
  }
}

function pupilCenter(eye) {
  const pixels = eye.pupilPixels();
  return {
    x: pixels.reduce((sum, [x]) => sum + x, 0) / pixels.length,
    y: pixels.reduce((sum, [, y]) => sum + y, 0) / pixels.length,
  };
}

const EYE_CENTER = (EYE_WHITE_SPANS.length - 1) / 2;

test('the pupil stays inside the eye white however hard the body moves', () => {
  const eye = new GooglyEye(0.15);
  for (let tick = 0; tick < 600; tick++) {
    if (tick % 37 === 0) eye.jump();
    if (tick % 53 === 0) eye.hit(tick % 2 === 0 ? 1 : -1);
    eye.update(Math.sin(tick * 0.3) * 8, Math.cos(tick * 0.17) * 8);
    assertPupilInsideWhite(eye);
  }
});

test('the pupil settles in the center once the body is at rest', () => {
  const eye = new GooglyEye(0.15);
  eye.hit(1);
  eye.jump();
  for (let tick = 0; tick < 20; tick++) eye.update(3, -2);
  for (let tick = 0; tick < 300; tick++) eye.update(0, 0);

  assert.deepEqual(pupilCenter(eye), { x: EYE_CENTER, y: EYE_CENTER });
});

test('the pupil lags opposite to the way the body moves', () => {
  const movingRight = new GooglyEye(0.15);
  const movingUp = new GooglyEye(0.15);
  for (let tick = 0; tick < 60; tick++) {
    movingRight.update(2, 0);
    movingUp.update(0, -2);
  }

  assert.ok(pupilCenter(movingRight).x < EYE_CENTER);
  assert.equal(pupilCenter(movingRight).y, EYE_CENTER);
  assert.ok(pupilCenter(movingUp).y > EYE_CENTER);
  assert.equal(pupilCenter(movingUp).x, EYE_CENTER);
});

test('a jump sends the pupil up', () => {
  const eye = new GooglyEye(0.15);
  eye.jump();
  eye.update(0, 0);

  assert.ok(pupilCenter(eye).y < EYE_CENTER);
});

test('a hit leaves the pupil behind, then rattles it back past the center', () => {
  const eye = new GooglyEye(0.15);
  eye.hit(1);
  const pupilXs = [];
  for (let tick = 0; tick < 30; tick++) {
    eye.update(0, 0);
    pupilXs.push(pupilCenter(eye).x);
  }

  assert.ok(pupilXs[0] < EYE_CENTER);
  assert.ok(Math.max(...pupilXs) > EYE_CENTER);
});
