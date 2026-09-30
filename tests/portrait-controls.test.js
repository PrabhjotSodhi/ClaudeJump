import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONTROLS_PANEL_WIDTH } from '../src/engine/portrait-layout.js';
import { createTouchInput, mapTouchesToInput, portraitTouchButtons } from '../src/engine/touch-input.js';

const PANEL_HEIGHT = 170;
const BUTTONS = portraitTouchButtons(PANEL_HEIGHT);

function centerOf(buttonId) {
  const button = BUTTONS.find((candidate) => candidate.id === buttonId);
  return { x: button.x + button.width / 2, y: button.y + button.height / 2 };
}

function pressedControls(input) {
  return Object.keys(input)
    .filter((control) => input[control] && control !== 'tap')
    .sort();
}

test('every panel button fits inside the panel and no two overlap', () => {
  for (const button of BUTTONS) {
    assert.ok(button.x >= 0 && button.x + button.width <= CONTROLS_PANEL_WIDTH, button.id);
    assert.ok(button.y >= 0 && button.y + button.height <= PANEL_HEIGHT, button.id);
  }
  for (const first of BUTTONS) {
    for (const second of BUTTONS) {
      if (first === second) continue;
      const apart =
        first.x + first.width <= second.x ||
        second.x + second.width <= first.x ||
        first.y + first.height <= second.y ||
        second.y + second.height <= first.y;
      assert.ok(apart, `${first.id} and ${second.id}`);
    }
  }
});

test('the rocker halves and the two action buttons are sized for thumbs', () => {
  const byId = (id) => BUTTONS.find((button) => button.id === id);
  for (const id of ['left', 'right']) assert.ok(byId(id).width >= CONTROLS_PANEL_WIDTH * 0.27, id);
  for (const id of ['action', 'jump']) assert.ok(byId(id).width >= CONTROLS_PANEL_WIDTH * 0.25, id);
  assert.equal(byId('left').x + byId('left').width, byId('right').x, 'the halves form one rocker');
});

test('panel touches map to the same input records as the landscape buttons', () => {
  assert.deepEqual(pressedControls(mapTouchesToInput([centerOf('right')], null, BUTTONS)), ['right']);
  assert.deepEqual(pressedControls(mapTouchesToInput([centerOf('action')], null, BUTTONS)), ['action', 'down']);
  assert.deepEqual(pressedControls(mapTouchesToInput([centerOf('pause')], null, BUTTONS)), ['pause']);
  assert.deepEqual(pressedControls(mapTouchesToInput([centerOf('left'), centerOf('jump')], null, BUTTONS)), [
    'confirm',
    'jump',
    'left',
  ]);
});

// The game canvas shows the game one to one at the top. The panel canvas sits below it at double size.
function createPhone() {
  const listeners = { game: {}, controls: {} };
  const gameCanvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 360 }),
    addEventListener: (name, listener) => (listeners.game[name] = listener),
  };
  const controlsCanvas = {
    width: CONTROLS_PANEL_WIDTH,
    height: PANEL_HEIGHT,
    getBoundingClientRect: () => ({ left: 0, top: 400, width: CONTROLS_PANEL_WIDTH * 2, height: PANEL_HEIGHT * 2 }),
    addEventListener: (name, listener) => (listeners.controls[name] = listener),
  };
  const touchInput = createTouchInput(gameCanvas, ['red', 'blue'], controlsCanvas);
  function touch(area, points) {
    const touches = points.map((point) => ({ clientX: point.x, clientY: point.y }));
    const target = area === 'controls' ? controlsCanvas : gameCanvas;
    listeners[area].touchstart({ target, touches, changedTouches: touches });
  }
  return { touchInput, touch };
}

function panelScreenPoint(buttonId) {
  const center = centerOf(buttonId);
  return { x: center.x * 2, y: 400 + center.y * 2 };
}

test('a finger on the panel scales from screen pixels to panel pixels', () => {
  const { touchInput, touch } = createPhone();
  touch('controls', [panelScreenPoint('jump')]);

  const inputByPlayerId = touchInput.sample(BUTTONS, 'controls');

  assert.deepEqual(pressedControls(inputByPlayerId.red), ['confirm', 'jump']);
  assert.deepEqual(pressedControls(inputByPlayerId.blue), []);
});

test('two fingers on the panel run and jump at once', () => {
  const { touchInput, touch } = createPhone();
  touch('controls', [panelScreenPoint('left'), panelScreenPoint('jump')]);

  assert.deepEqual(pressedControls(touchInput.sample(BUTTONS, 'controls').red), ['confirm', 'jump', 'left']);
});

test('a finger on the panel is not a tap on the game', () => {
  const { touchInput, touch } = createPhone();
  touch('controls', [panelScreenPoint('left')]);

  assert.equal(touchInput.sample(BUTTONS, 'controls').red.tap, null);
});

test('a tap on the game still reaches menus and presses no panel button', () => {
  const { touchInput, touch } = createPhone();
  touch('game', [{ x: 100, y: 200 }]);

  const input = touchInput.sample(BUTTONS, 'controls').red;

  assert.deepEqual(input.tap, { x: 100, y: 200 });
  assert.deepEqual(pressedControls(input), []);
});

test('the pressed buttons under a finger are reported for drawing', () => {
  const { touchInput, touch } = createPhone();
  touch('controls', [panelScreenPoint('right')]);

  assert.deepEqual(
    touchInput.pressedButtons(BUTTONS, 'controls').map((button) => button.id),
    ['right'],
  );
});

test('pause is small in the top right corner and the controls fill the lower 60 percent', () => {
  const pause = BUTTONS.find((button) => button.id === 'pause');
  assert.ok(pause.width <= 32 && pause.height <= 20);
  assert.ok(pause.x + pause.width > CONTROLS_PANEL_WIDTH - 12 && pause.y < 12);
  const jump = BUTTONS.find((button) => button.id === 'jump');
  const action = BUTTONS.find((button) => button.id === 'action');
  assert.ok(action.x < jump.x && action.y > jump.y, 'shove is lower left of jump');
  for (const button of BUTTONS.filter((candidate) => candidate.id !== 'pause')) {
    assert.ok(button.y >= PANEL_HEIGHT * 0.4, `${button.id} is in the lower 60 percent`);
  }
});
