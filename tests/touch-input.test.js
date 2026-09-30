import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapTouchesToInput, TOUCH_BUTTONS } from '../src/engine/touch-input.js';

function centerOf(buttonId) {
  const button = TOUCH_BUTTONS.find((candidate) => candidate.id === buttonId);
  return { x: button.x + button.width / 2, y: button.y + button.height / 2 };
}

function pressedControls(input) {
  return Object.keys(input)
    .filter((control) => input[control] && control !== 'tap')
    .sort();
}

test('no touches press nothing', () => {
  assert.deepEqual(pressedControls(mapTouchesToInput([])), []);
});

test('a touch on the right button runs right', () => {
  assert.deepEqual(pressedControls(mapTouchesToInput([centerOf('right')])), ['right']);
});

test('two fingers run and jump at once', () => {
  const input = mapTouchesToInput([centerOf('left'), centerOf('jump')]);

  assert.deepEqual(pressedControls(input), ['confirm', 'jump', 'left']);
});

test('action presses down so it moves menu selections', () => {
  assert.deepEqual(pressedControls(mapTouchesToInput([centerOf('action')])), ['action', 'down']);
});

test('the pause button presses pause', () => {
  assert.deepEqual(pressedControls(mapTouchesToInput([centerOf('pause')])), ['pause']);
});

test('a touch between buttons presses nothing and a tap is passed through', () => {
  const input = mapTouchesToInput([{ x: 320, y: 180 }], { x: 320, y: 180 });

  assert.deepEqual(pressedControls(input), []);
  assert.deepEqual(input.tap, { x: 320, y: 180 });
});
