import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapGamepadToInput, mapGamepadsToInputs } from '../src/engine/gamepad-input.js';

function fakeGamepad({ buttonsPressed = [], axes = [0, 0] } = {}) {
  const buttons = [];
  for (let index = 0; index < 16; index++) {
    buttons.push({ pressed: buttonsPressed.includes(index) });
  }
  return { buttons, axes };
}

test('neutral gamepad state maps to no input pressed', () => {
  const input = mapGamepadToInput(fakeGamepad());

  assert.deepEqual(input, {
    left: false,
    right: false,
    jump: false,
    up: false,
    down: false,
    action: false,
    confirm: false,
    pause: false,
  });
});

test('a missing gamepad maps to no input pressed', () => {
  const input = mapGamepadToInput(null);

  assert.deepEqual(input, {
    left: false,
    right: false,
    jump: false,
    up: false,
    down: false,
    action: false,
    confirm: false,
    pause: false,
  });
});

test('left stick past the dead zone moves left or right', () => {
  const leftInput = mapGamepadToInput(fakeGamepad({ axes: [-0.5, 0] }));
  const rightInput = mapGamepadToInput(fakeGamepad({ axes: [0.5, 0] }));

  assert.equal(leftInput.left, true);
  assert.equal(leftInput.right, false);
  assert.equal(rightInput.right, true);
  assert.equal(rightInput.left, false);
});

test('left stick inside the dead zone counts as neutral', () => {
  const input = mapGamepadToInput(fakeGamepad({ axes: [0.1, -0.1] }));

  assert.equal(input.left, false);
  assert.equal(input.right, false);
  assert.equal(input.down, false);
});

test('d-pad buttons move left, right and down', () => {
  const leftInput = mapGamepadToInput(fakeGamepad({ buttonsPressed: [14] }));
  const rightInput = mapGamepadToInput(fakeGamepad({ buttonsPressed: [15] }));
  const downInput = mapGamepadToInput(fakeGamepad({ buttonsPressed: [13] }));

  assert.equal(leftInput.left, true);
  assert.equal(rightInput.right, true);
  assert.equal(downInput.down, true);
});

test('button A jumps and button B plays the action button', () => {
  const input = mapGamepadToInput(fakeGamepad({ buttonsPressed: [0, 1] }));

  assert.equal(input.jump, true);
  assert.equal(input.action, true);
});

test('button Start pauses', () => {
  const input = mapGamepadToInput(fakeGamepad({ buttonsPressed: [9] }));

  assert.equal(input.pause, true);
});

test('mapGamepadsToInputs assigns by browser slot, not by connection order', () => {
  const bluePad = fakeGamepad({ buttonsPressed: [0] });
  const gamepads = [null, bluePad]; // red's pad was unplugged; blue's pad stays at slot 1

  const inputs = mapGamepadsToInputs(gamepads, ['red', 'blue']);

  assert.equal(inputs.red.jump, false);
  assert.equal(inputs.blue.jump, true);
});

test('right trigger and B produce action', () => {
  assert.equal(mapGamepadToInput(fakeGamepad({ buttonsPressed: [7] })).action, true);
  assert.equal(mapGamepadToInput(fakeGamepad({ buttonsPressed: [1] })).action, true);
});

test('stick down and d-pad down move menus but never produce action', () => {
  const stickInput = mapGamepadToInput(fakeGamepad({ axes: [0.7, 0.9] }));
  const dpadInput = mapGamepadToInput(fakeGamepad({ buttonsPressed: [13] }));

  assert.equal(stickInput.down, true);
  assert.equal(stickInput.action, false);
  assert.equal(dpadInput.down, true);
  assert.equal(dpadInput.action, false);
});

test('stick up and d-pad up produce up', () => {
  assert.equal(mapGamepadToInput(fakeGamepad({ axes: [0, -0.9] })).up, true);
  assert.equal(mapGamepadToInput(fakeGamepad({ buttonsPressed: [12] })).up, true);
  assert.equal(mapGamepadToInput(fakeGamepad()).up, false);
});

test('A produces jump and confirm, and B does not confirm', () => {
  const aInput = mapGamepadToInput(fakeGamepad({ buttonsPressed: [0] }));
  const bInput = mapGamepadToInput(fakeGamepad({ buttonsPressed: [1] }));

  assert.equal(aInput.jump, true);
  assert.equal(aInput.confirm, true);
  assert.equal(bInput.confirm, false);
});
