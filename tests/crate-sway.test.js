import assert from 'node:assert/strict';
import { test } from 'node:test';
import { swayOffset } from '../src/entities/crate.js';

test('the sway is the same for the same tick count and distance', () => {
  assert.equal(swayOffset(17, 90), swayOffset(17, 90));
});

test('the crate swings both ways while it is high up', () => {
  const offsets = Array.from({ length: 70 }, (_, tick) => swayOffset(tick, 200));
  assert.ok(Math.min(...offsets) < 0 && Math.max(...offsets) > 0);
});

test('the sway settles to nothing at the ground', () => {
  for (let tick = 0; tick < 70; tick++) {
    assert.equal(swayOffset(tick, 0), 0);
    assert.ok(Math.abs(swayOffset(tick, 8)) <= 1);
  }
});
