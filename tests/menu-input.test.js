import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { mapGamepadToInput } from '../src/engine/gamepad-input.js';
import { createKeyboardInput } from '../src/engine/input.js';
import { mapTouchesToInput, MENU_TOUCH_BUTTONS } from '../src/engine/touch-input.js';
import { MenuInput, menuStep } from '../src/ui/menu-input.js';

const KEY_MAPPINGS = JSON.parse(readFileSync(new URL('../data/config/key-mappings.json', import.meta.url), 'utf8'));

// The records the real keyboard code sends while one key is down.
function keyboardRecordsFor(code) {
  const listeners = {};
  globalThis.addEventListener = (type, listener) => (listeners[type] = listener);
  const keyboard = createKeyboardInput(structuredClone(KEY_MAPPINGS));
  listeners.keydown({ code, repeat: false, preventDefault() {} });
  return keyboard.sample();
}

function padRecordFor(buttonIndex, axes = [0, 0]) {
  const buttons = Array.from({ length: 16 }, (_, index) => ({ pressed: index === buttonIndex }));
  return mapGamepadToInput({ buttons, axes });
}

function touchRecordFor(buttonId) {
  const button = MENU_TOUCH_BUTTONS.find((candidate) => candidate.id === buttonId);
  return mapTouchesToInput([{ x: button.x + 2, y: button.y + 2 }], MENU_TOUCH_BUTTONS);
}

// A shared menu: whatever anyone pressed, as a step and whether it confirms or goes back.
function sharedMenuReads(inputByPlayerId) {
  const menuInput = new MenuInput(Object.fromEntries(Object.keys(inputByPlayerId).map((id) => [id, {}])));
  const presses = menuInput.presses(inputByPlayerId);
  return { step: menuStep(presses), confirm: presses.confirm, back: presses.back };
}

// A screen with a seat per player: who did what.
function seatReads(inputByPlayerId) {
  const menuInput = new MenuInput(Object.fromEntries(Object.keys(inputByPlayerId).map((id) => [id, {}])));
  const reads = {};
  for (const [playerId, presses] of Object.entries(menuInput.pressesByPlayerId(inputByPlayerId))) {
    const actions = Object.entries(presses).filter(([, pressed]) => pressed);
    if (actions.length > 0) reads[playerId] = actions.map(([name]) => name).join(' ');
  }
  return reads;
}

const UP = { step: -1, confirm: false, back: false };
const DOWN = { step: 1, confirm: false, back: false };
const CONFIRM = { step: 0, confirm: true, back: false };
const BACK = { step: 0, confirm: false, back: true };

test('a shared menu moves with the arrow keys or WASD, confirms with Enter or Space and goes back with Escape or Backspace', () => {
  const expected = {
    KeyW: UP,
    KeyA: UP,
    KeyS: DOWN,
    KeyD: DOWN,
    ArrowUp: UP,
    ArrowLeft: UP,
    ArrowDown: DOWN,
    ArrowRight: DOWN,
    Enter: CONFIRM,
    Space: CONFIRM,
    Escape: BACK,
    Backspace: BACK,
  };
  for (const [code, reads] of Object.entries(expected)) {
    assert.deepEqual(sharedMenuReads(keyboardRecordsFor(code)), reads, code);
  }
});

test('a shared menu moves with the d-pad or stick, confirms with A and goes back with B', () => {
  assert.deepEqual(sharedMenuReads({ red: padRecordFor(12) }), UP, 'd-pad up');
  assert.deepEqual(sharedMenuReads({ red: padRecordFor(13) }), DOWN, 'd-pad down');
  assert.deepEqual(sharedMenuReads({ red: padRecordFor(14) }), UP, 'd-pad left');
  assert.deepEqual(sharedMenuReads({ red: padRecordFor(15) }), DOWN, 'd-pad right');
  assert.deepEqual(sharedMenuReads({ red: padRecordFor(-1, [0, -1]) }), UP, 'stick up');
  assert.deepEqual(sharedMenuReads({ red: padRecordFor(-1, [1, 0]) }), DOWN, 'stick right');
  assert.deepEqual(sharedMenuReads({ red: padRecordFor(0) }), CONFIRM, 'A');
  assert.deepEqual(sharedMenuReads({ red: padRecordFor(1) }), BACK, 'B');
});

test('a shared menu on touch moves with the arrows, confirms with jump and goes back with shove', () => {
  assert.deepEqual(sharedMenuReads({ red: touchRecordFor('left') }), UP);
  assert.deepEqual(sharedMenuReads({ red: touchRecordFor('right') }), DOWN);
  assert.deepEqual(sharedMenuReads({ red: touchRecordFor('jump') }), CONFIRM);
  assert.deepEqual(sharedMenuReads({ red: touchRecordFor('action') }), BACK);
});

test('on a screen with a seat per player, each player picks, joins and steps back with their own keys', () => {
  const expected = {
    KeyA: { red: 'left' },
    KeyD: { red: 'right' },
    KeyW: { red: 'confirm' },
    KeyS: { red: 'back' },
    ArrowLeft: { blue: 'left' },
    ArrowRight: { blue: 'right' },
    ArrowUp: { blue: 'confirm' },
    ArrowDown: { blue: 'back' },
    Enter: { red: 'confirm' },
    Space: { red: 'confirm' },
    Escape: { red: 'back' },
    Backspace: { red: 'back' },
  };
  for (const [code, reads] of Object.entries(expected)) {
    assert.deepEqual(seatReads(keyboardRecordsFor(code)), reads, code);
  }
});

test('on a screen with a seat per player, a pad picks with the d-pad, joins with A and steps back with B', () => {
  assert.deepEqual(seatReads({ green: padRecordFor(14) }), { green: 'left' });
  assert.deepEqual(seatReads({ green: padRecordFor(15) }), { green: 'right' });
  assert.deepEqual(seatReads({ green: padRecordFor(0) }), { green: 'confirm' });
  assert.deepEqual(seatReads({ green: padRecordFor(1) }), { green: 'back' });
});

test('a press counts once until it is let go, and a press held as the menu opens does not count', () => {
  const enter = keyboardRecordsFor('Enter');
  const nothing = keyboardRecordsFor('KeyQ');
  const menuInput = new MenuInput(enter);

  assert.equal(menuInput.presses(enter).confirm, false, 'held over from the screen before');
  menuInput.presses(nothing);
  assert.equal(menuInput.presses(enter).confirm, true);
  assert.equal(menuInput.presses(enter).confirm, false, 'still held');
});
