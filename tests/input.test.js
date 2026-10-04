import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { combineInputs, createKeyboardInput } from '../src/engine/input.js';

function input({
  left = false,
  right = false,
  jump = false,
  up = false,
  down = false,
  action = false,
  confirm = false,
  back = false,
  pause = false,
} = {}) {
  return { left, right, jump, up, down, action, confirm, back, pause };
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
  const keyboard = { red: input({ action: true }) };
  const gamepad = {};

  const combined = combineInputs(keyboard, gamepad);

  assert.equal(combined.red.action, true);
});

test('combineInputs presses up and confirm when either source presses them', () => {
  const keyboard = { red: input({ confirm: true }), blue: input() };
  const gamepad = { red: input(), blue: input({ up: true }) };

  const combined = combineInputs(keyboard, gamepad);

  assert.equal(combined.red.confirm, true);
  assert.equal(combined.blue.up, true);
  assert.equal(combined.blue.confirm, false);
});

function keyboardWith(keyMappings) {
  const listeners = {};
  globalThis.addEventListener = (type, listener) => (listeners[type] = listener);
  const keyboard = createKeyboardInput(keyMappings);
  const press = (code) => listeners.keydown({ code, repeat: false, preventDefault() {} });
  const release = (code) => listeners.keyup({ code });
  return { keyboard, press, release };
}

const KEY_MAPPINGS = JSON.parse(readFileSync(new URL('../data/config/key-mappings.json', import.meta.url), 'utf8'));

test('S and down arrow produce action and down, and C and comma produce nothing', () => {
  const { keyboard, press, release } = keyboardWith(KEY_MAPPINGS);

  press('KeyS');
  press('ArrowDown');
  const pressed = keyboard.sample();
  release('KeyS');
  release('ArrowDown');
  press('KeyC');
  press('Comma');
  const legacy = keyboard.sample();

  assert.equal(pressed.red.action, true);
  assert.equal(pressed.blue.action, true);
  assert.equal(pressed.red.down, true);
  assert.equal(legacy.red.action, false);
  assert.equal(legacy.blue.action, false);
});

test('W and up arrow produce up and jump', () => {
  const { keyboard, press } = keyboardWith(KEY_MAPPINGS);

  press('KeyW');
  press('ArrowUp');
  const pressed = keyboard.sample();

  assert.equal(pressed.red.up, true);
  assert.equal(pressed.red.jump, true);
  assert.equal(pressed.blue.up, true);
  assert.equal(pressed.blue.jump, true);
});

test('Enter and Space confirm and Escape and Backspace go back for the first player only', () => {
  const { keyboard, press, release } = keyboardWith(KEY_MAPPINGS);
  const sampleWith = (code) => {
    press(code);
    const inputs = keyboard.sample();
    release(code);
    return inputs;
  };

  const jumpOnly = sampleWith('KeyW');
  assert.equal(jumpOnly.red.confirm, false);
  for (const code of ['Enter', 'Space']) {
    const inputs = sampleWith(code);
    assert.equal(inputs.red.confirm, true, code);
    assert.equal(inputs.blue.confirm, false, code);
  }
  for (const code of ['Escape', 'Backspace']) {
    const inputs = sampleWith(code);
    assert.equal(inputs.red.back, true, code);
    assert.equal(inputs.blue.back, false, code);
  }
});

test('combineInputs merges three sources', () => {
  const keyboard = { red: input() };
  const gamepad = { red: input() };
  const touch = { red: input({ jump: true }) };

  const combined = combineInputs(keyboard, gamepad, touch);

  assert.equal(combined.red.jump, true);
});

test('combineInputs keeps a player that only the gamepad knows, like the green and yellow seats', () => {
  const keyboard = { red: input(), blue: input() };
  const gamepad = { red: input(), blue: input(), green: input({ jump: true }), yellow: input({ left: true }) };

  const combined = combineInputs(keyboard, gamepad);

  assert.deepEqual(Object.keys(combined), ['red', 'blue', 'green', 'yellow']);
  assert.equal(combined.green.jump, true);
  assert.equal(combined.yellow.left, true);
  assert.equal(combined.red.jump, false);
});
