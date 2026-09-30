import { SCREEN_HEIGHT, SCREEN_WIDTH } from './config.js';

// About 12 mm on a phone held in landscape, where the 640 pixel wide screen fills the display.
const BUTTON_SIZE = 68;
const BUTTON_GAP = 8;
const EDGE_MARGIN = 12;
const BOTTOM_Y = SCREEN_HEIGHT - EDGE_MARGIN - BUTTON_SIZE;
// The pause button is small and sits at the top center, under the timer, where it covers nothing.
const PAUSE_WIDTH = 32;
const PAUSE_HEIGHT = 22;
const PAUSE_TOP_Y = 28;
// Two players share the screen with a compact 2x2 cluster each, at the left and right edges, under the HUD panels.
// The rows sit in the band that holds no spawn or ledge top on any arena, so the clusters cover neither.
const CLUSTER_BUTTON_SIZE = 40;
const CLUSTER_GAP = 4;
const CLUSTER_EDGE_MARGIN = 8;
const CLUSTER_WIDTH = 2 * CLUSTER_BUTTON_SIZE + CLUSTER_GAP;
const CLUSTER_TOP_Y = 56;

const PAUSE_BUTTON = {
  id: 'pause',
  x: (SCREEN_WIDTH - PAUSE_WIDTH) / 2,
  y: PAUSE_TOP_Y,
  width: PAUSE_WIDTH,
  height: PAUSE_HEIGHT,
};

// The controls in game pixels. Drawing and hit testing both read the lists, so they never drift apart.
// Action also presses down, like the keyboard's shove key, so it moves menu selections.
// One player: all buttons fill the first player's record.
export const TOUCH_BUTTONS = [
  { id: 'left', x: EDGE_MARGIN, y: BOTTOM_Y },
  { id: 'right', x: EDGE_MARGIN + BUTTON_SIZE + BUTTON_GAP, y: BOTTOM_Y },
  { id: 'jump', x: SCREEN_WIDTH - EDGE_MARGIN - BUTTON_SIZE, y: BOTTOM_Y },
  { id: 'action', x: SCREEN_WIDTH - EDGE_MARGIN - 2 * BUTTON_SIZE - BUTTON_GAP, y: BOTTOM_Y },
  PAUSE_BUTTON,
].map((button) => ({ width: BUTTON_SIZE, height: BUTTON_SIZE, ...button }));

function clusterButtons(playerId, clusterX) {
  const secondColumnX = clusterX + CLUSTER_BUTTON_SIZE + CLUSTER_GAP;
  const secondRowY = CLUSTER_TOP_Y + CLUSTER_BUTTON_SIZE + CLUSTER_GAP;
  return [
    { id: 'jump', x: clusterX, y: CLUSTER_TOP_Y },
    { id: 'action', x: secondColumnX, y: CLUSTER_TOP_Y },
    { id: 'left', x: clusterX, y: secondRowY },
    { id: 'right', x: secondColumnX, y: secondRowY },
  ].map((button) => ({ playerId, width: CLUSTER_BUTTON_SIZE, height: CLUSTER_BUTTON_SIZE, ...button }));
}

// Two players: each cluster fills only its own player's record. Pause fills the first player's.
export const TWO_PLAYER_TOUCH_BUTTONS = [
  ...clusterButtons('red', CLUSTER_EDGE_MARGIN),
  ...clusterButtons('blue', SCREEN_WIDTH - CLUSTER_EDGE_MARGIN - CLUSTER_WIDTH),
  PAUSE_BUTTON,
];

function isInside(button, point) {
  return (
    point.x >= button.x &&
    point.x < button.x + button.width &&
    point.y >= button.y &&
    point.y < button.y + button.height
  );
}

export function pressedButtons(points, buttons = TOUCH_BUTTONS) {
  return buttons.filter((button) => points.some((point) => isInside(button, point)));
}

// Points are in game pixels. Every finger counts, so running and jumping at once works.
// A tap is where a finger last went down, for menus that select what was touched.
export function mapTouchesToInput(points, tap = null, buttons = TOUCH_BUTTONS) {
  const pressed = pressedButtons(points, buttons).map((button) => button.id);
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

// Touch state only. A button with a playerId fills that player's record. Buttons without one, and
// the tap, fill the first player's.
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
    pressedButtons(buttons = TOUCH_BUTTONS) {
      return pressedButtons(points, buttons);
    },
    hide() {
      visible = false;
    },
    sample(buttons = TOUCH_BUTTONS) {
      const inputByPlayerId = {};
      playerIds.forEach((playerId, index) => {
        const playerButtons = buttons.filter((button) => (button.playerId ?? playerIds[0]) === playerId);
        inputByPlayerId[playerId] = mapTouchesToInput(points, index === 0 ? tap : null, playerButtons);
      });
      tap = null;
      return inputByPlayerId;
    },
  };
}
