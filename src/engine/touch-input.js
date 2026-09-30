import { SCREEN_HEIGHT, SCREEN_WIDTH } from './config.js';

// About 12 mm on a phone held in landscape, where the 640 pixel wide screen fills the display.
const BUTTON_SIZE = 68;
const BUTTON_GAP = 8;
const EDGE_MARGIN = 12;
const BOTTOM_Y = SCREEN_HEIGHT - EDGE_MARGIN - BUTTON_SIZE;
const PAUSE_TOP_Y = 42;

// The controls in game pixels. Drawing and hit testing both read this list, so they never drift apart.
// Action also presses down, like the keyboard's shove key, so it moves menu selections.
export const TOUCH_BUTTONS = [
  { id: 'left', x: EDGE_MARGIN, y: BOTTOM_Y },
  { id: 'right', x: EDGE_MARGIN + BUTTON_SIZE + BUTTON_GAP, y: BOTTOM_Y },
  { id: 'jump', x: SCREEN_WIDTH - EDGE_MARGIN - BUTTON_SIZE, y: BOTTOM_Y },
  { id: 'action', x: SCREEN_WIDTH - EDGE_MARGIN - 2 * BUTTON_SIZE - BUTTON_GAP, y: BOTTOM_Y },
  { id: 'pause', x: EDGE_MARGIN, y: PAUSE_TOP_Y },
].map((button) => ({ ...button, width: BUTTON_SIZE, height: BUTTON_SIZE }));

function isInside(button, point) {
  return (
    point.x >= button.x &&
    point.x < button.x + button.width &&
    point.y >= button.y &&
    point.y < button.y + button.height
  );
}

export function pressedButtonIds(points) {
  return TOUCH_BUTTONS.filter((button) => points.some((point) => isInside(button, point))).map((button) => button.id);
}

// Points are in game pixels. Every finger counts, so running and jumping at once works.
// A tap is where a finger last went down, for menus that select what was touched.
export function mapTouchesToInput(points, tap = null) {
  const pressed = pressedButtonIds(points);
  return {
    left: pressed.includes('left'),
    right: pressed.includes('right'),
    jump: pressed.includes('jump'),
    up: false,
    down: pressed.includes('action'),
    action: pressed.includes('action'),
    confirm: pressed.includes('jump'),
    pause: pressed.includes('pause'),
    tap,
  };
}

// Touch state only. The first player id gets the touches, the others get no input.
export function createTouchInput(canvas, playerIds) {
  let points = [];
  let tap = null;
  let visible = false;

  function toGamePoint(touch) {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((touch.clientX - bounds.left) / bounds.width) * SCREEN_WIDTH,
      y: ((touch.clientY - bounds.top) / bounds.height) * SCREEN_HEIGHT,
    };
  }

  function updatePoints(event) {
    if (canvas.getBoundingClientRect().width === 0) return;
    points = Array.from(event.touches, toGamePoint);
  }

  canvas.addEventListener('touchstart', (event) => {
    visible = true;
    if (canvas.getBoundingClientRect().width > 0) tap = toGamePoint(event.changedTouches[0]);
    updatePoints(event);
  });
  canvas.addEventListener('touchmove', updatePoints);
  canvas.addEventListener('touchend', updatePoints);
  canvas.addEventListener('touchcancel', updatePoints);

  return {
    get visible() {
      return visible;
    },
    get pressedButtonIds() {
      return pressedButtonIds(points);
    },
    hide() {
      visible = false;
    },
    sample() {
      const inputByPlayerId = {};
      playerIds.forEach((playerId, index) => {
        inputByPlayerId[playerId] = index === 0 ? mapTouchesToInput(points, tap) : mapTouchesToInput([]);
      });
      tap = null;
      return inputByPlayerId;
    },
  };
}
