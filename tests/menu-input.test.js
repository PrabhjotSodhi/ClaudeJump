import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapGamepadToInput } from '../src/engine/gamepad-input.js';
import { mapTouchesToInput, MENU_TOUCH_BUTTONS } from '../src/engine/touch-input.js';
import { MenuInput, menuStep } from '../src/ui/menu-input.js';

function idle() {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    action: false,
    confirm: false,
    pause: false,
  };
}

// The records each device sends for one button, as the input code builds them.
const KEYBOARD = {
  left: { ...idle(), left: true },
  right: { ...idle(), right: true },
  jumpKey: { ...idle(), jump: true, up: true },
  shoveKey: { ...idle(), action: true, down: true },
  enter: { ...idle(), confirm: true },
  escape: { ...idle(), pause: true },
};

function padWith(buttonIndex, axes = [0, 0]) {
  const buttons = Array.from({ length: 16 }, (_, index) => ({ pressed: index === buttonIndex }));
  return mapGamepadToInput({ buttons, axes });
}

function touchOn(buttonId) {
  const button = MENU_TOUCH_BUTTONS.find((candidate) => candidate.id === buttonId);
  return mapTouchesToInput([{ x: button.x + 2, y: button.y + 2 }], MENU_TOUCH_BUTTONS);
}

function pressesFor(record) {
  const menuInput = new MenuInput({ red: idle() });
  return menuInput.presses({ red: record });
}

function summary(presses) {
  return { step: menuStep(presses), confirm: presses.confirm, back: presses.back };
}

test('every device moves with left and right, selects with jump and goes back with shove', () => {
  const moveLeft = { step: -1, confirm: false, back: false };
  const moveRight = { step: 1, confirm: false, back: false };
  const select = { step: 0, confirm: true, back: false };
  const back = { step: 0, confirm: false, back: true };

  assert.deepEqual(summary(pressesFor(KEYBOARD.left)), moveLeft);
  assert.deepEqual(summary(pressesFor(KEYBOARD.right)), moveRight);
  assert.deepEqual(summary(pressesFor(KEYBOARD.jumpKey)), select, 'the up key is jump, so it selects');
  assert.deepEqual(summary(pressesFor(KEYBOARD.shoveKey)), back, 'the down key is shove, so it goes back');
  assert.deepEqual(summary(pressesFor(KEYBOARD.enter)), select);
  assert.deepEqual(summary(pressesFor(KEYBOARD.escape)), back);

  assert.deepEqual(summary(pressesFor(padWith(0))), select, 'pad A');
  assert.deepEqual(summary(pressesFor(padWith(1))), back, 'pad B');
  assert.deepEqual(summary(pressesFor(padWith(14))), moveLeft, 'pad d-pad left');
  assert.deepEqual(summary(pressesFor(padWith(-1, [0, 1]))), moveRight, 'pad stick down moves on to the next');
  assert.deepEqual(summary(pressesFor(padWith(12))), moveLeft, 'pad d-pad up moves back');

  assert.deepEqual(summary(pressesFor(touchOn('left'))), moveLeft);
  assert.deepEqual(summary(pressesFor(touchOn('right'))), moveRight);
  assert.deepEqual(summary(pressesFor(touchOn('jump'))), select);
  assert.deepEqual(summary(pressesFor(touchOn('action'))), back);
});

test('a press counts once until it is let go, and a press held as the menu opens does not count', () => {
  const menuInput = new MenuInput({ red: KEYBOARD.enter });

  assert.equal(menuInput.presses({ red: KEYBOARD.enter }).confirm, false, 'held over from the screen before');
  menuInput.presses({ red: idle() });
  assert.equal(menuInput.presses({ red: KEYBOARD.enter }).confirm, true);
  assert.equal(menuInput.presses({ red: KEYBOARD.enter }).confirm, false, 'still held');
});

test('each player has their own presses, and the merged presses take any of them', () => {
  const menuInput = new MenuInput();

  const pressesByPlayerId = menuInput.pressesByPlayerId({ red: KEYBOARD.left, blue: KEYBOARD.shoveKey });

  assert.equal(pressesByPlayerId.red.previous, true);
  assert.equal(pressesByPlayerId.red.back, false);
  assert.equal(pressesByPlayerId.blue.back, true);
  menuInput.presses({ red: idle(), blue: idle() });
  const merged = menuInput.presses({ red: KEYBOARD.right, blue: KEYBOARD.jumpKey });
  assert.equal(merged.next, true);
  assert.equal(merged.confirm, true);
});
