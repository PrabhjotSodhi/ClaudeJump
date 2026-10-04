import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createTouchInput,
  mapTouchesToInput,
  TOUCH_BUTTONS,
  touchButtonsFor,
  TWO_PLAYER_TOUCH_BUTTONS,
} from '../src/engine/touch-input.js';

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

test('action shoves and goes back in menus', () => {
  assert.deepEqual(pressedControls(mapTouchesToInput([centerOf('action')])), ['action', 'back']);
});

test('the pause button presses pause', () => {
  assert.deepEqual(pressedControls(mapTouchesToInput([centerOf('pause')])), ['pause']);
});

test('a touch between buttons presses nothing', () => {
  const input = mapTouchesToInput([{ x: 320, y: 180 }]);

  assert.deepEqual(pressedControls(input), []);
});

function clusterCenterOf(playerId, buttonId) {
  const button = TWO_PLAYER_TOUCH_BUTTONS.find(
    (candidate) => candidate.playerId === playerId && candidate.id === buttonId,
  );
  return { x: button.x + button.width / 2, y: button.y + button.height / 2 };
}

// A canvas that shows the game one to one, and a touch list the test fills.
function sampleTwoPlayers(points) {
  const listeners = {};
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 360 }),
    addEventListener: (name, listener) => (listeners[name] = listener),
  };
  const touchInput = createTouchInput(canvas, ['red', 'blue']);
  const touches = points.map((point) => ({ clientX: point.x, clientY: point.y }));
  listeners.touchstart({ touches, changedTouches: touches });
  return touchInput.sample(TWO_PLAYER_TOUCH_BUTTONS);
}

test('touches on each side map only to that player when both press at once', () => {
  const inputByPlayerId = sampleTwoPlayers([
    clusterCenterOf('red', 'right'),
    clusterCenterOf('red', 'jump'),
    clusterCenterOf('blue', 'left'),
    clusterCenterOf('blue', 'action'),
  ]);

  assert.deepEqual(pressedControls(inputByPlayerId.red), ['confirm', 'jump', 'right']);
  assert.deepEqual(pressedControls(inputByPlayerId.blue), ['action', 'back', 'left']);
});

test('a lone touch on one side leaves the other player untouched', () => {
  const inputByPlayerId = sampleTwoPlayers([clusterCenterOf('blue', 'jump')]);

  assert.deepEqual(pressedControls(inputByPlayerId.red), []);
  assert.deepEqual(pressedControls(inputByPlayerId.blue), ['confirm', 'jump']);
});

test('menus show the menu buttons, and scenes where players move show their own layout', () => {
  assert.deepEqual(
    touchButtonsFor({}).map((button) => button.id),
    ['left', 'right', 'jump', 'action'],
  );
  assert.equal(touchButtonsFor({ touchLayout: 'onePlayer' }), TOUCH_BUTTONS);
  assert.equal(touchButtonsFor({ matchScene: { touchLayout: 'twoPlayers' } }), TWO_PLAYER_TOUCH_BUTTONS);
  assert.equal(touchButtonsFor({ touchLayout: 'onePlayer', matchScene: { touchLayout: 'twoPlayers' } }), TOUCH_BUTTONS);
});
