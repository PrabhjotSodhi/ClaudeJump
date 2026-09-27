import assert from 'node:assert/strict';
import { test } from 'node:test';
import { combineInputs } from '../src/engine/input.js';

function input({ left = false, right = false, jump = false, down = false, card = false, pause = false } = {}) {
  return { left, right, jump, down, card, pause };
}

test('combineInputs presses a control when either source presses it', () => {
  const keyboard = { red: input({ left: true }), blue: input() };
  const gamepad = { red: input(), blue: input({ jump: true, left: true }) };

  const combined = combineInputs(keyboard, gamepad);

  assert.equal(combined.red.left, true);
  assert.equal(combined.red.jump, false);
  assert.equal(combined.blue.jump, true);
  assert.equal(combined.blue.left, true);
});

test('combineInputs stays false when neither source presses a control', () => {
  const keyboard = { red: input() };
  const gamepad = { red: input() };

  const combined = combineInputs(keyboard, gamepad);

  assert.deepEqual(combined.red, input());
});

test('combineInputs presses pause when either source presses it', () => {
  const keyboard = { red: input({ pause: true }), blue: input() };
  const gamepad = { red: input(), blue: input({ pause: true }) };

  const combined = combineInputs(keyboard, gamepad);

  assert.equal(combined.red.pause, true);
  assert.equal(combined.blue.pause, true);
});

test('combineInputs tolerates a player missing from the second source', () => {
  const keyboard = { red: input({ card: true }) };
  const gamepad = {};

  const combined = combineInputs(keyboard, gamepad);

  assert.equal(combined.red.card, true);
});
