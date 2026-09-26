import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Rocket } from '../src/entities/rocket.js';

function opponent({ x, y }) {
  return { id: 'blue', x, y, width: 8, height: 12, inWater: false };
}

test('a rocket steers gently toward the opponent instead of snapping to face them', () => {
  const rocket = new Rocket({ x: 100, y: 100, facing: 1, shooterId: 'red' });
  const target = opponent({ x: 100, y: 40 });

  rocket.update([target], []);

  assert.ok(rocket.velocityY < 0, 'the rocket starts turning toward a target above it');
  assert.ok(
    Math.abs(rocket.velocityY) < 0.2,
    'a single tick only nudges its course, it does not snap to face the target',
  );
});

test('a rocket explodes when it touches a platform', () => {
  const rocket = new Rocket({ x: 100, y: 100, facing: 1, shooterId: 'red' });
  const platform = { x: 102, y: 99, width: 10, height: 6 };

  rocket.update([], [platform]);

  assert.equal(rocket.exploded, true);
});

test('a rocket does not explode when it touches its own shooter', () => {
  const rocket = new Rocket({ x: 100, y: 100, facing: 1, shooterId: 'red' });
  const shooter = { id: 'red', x: 100, y: 100, width: 8, height: 12, inWater: false };

  rocket.update([shooter], []);

  assert.equal(rocket.exploded, false);
});

test('a rocket explodes after its lifetime runs out even if it hits nothing', () => {
  const rocket = new Rocket({ x: 100, y: 100, facing: 1, shooterId: 'red' });

  for (let tick = 0; tick < 239; tick++) rocket.update([], []);
  assert.equal(rocket.exploded, false, 'still flying one tick before its lifetime ends');

  rocket.update([], []);
  assert.equal(rocket.exploded, true, 'expires on the 240th tick');
});
