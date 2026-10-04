import { SCREEN_HEIGHT, SCREEN_WIDTH } from './config.js';
import { CONTROLS_PANEL_WIDTH } from './portrait-layout.js';

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

// Menus use the one player buttons without pause: left and right move, jump selects and shove goes back.
export const MENU_TOUCH_BUTTONS = TOUCH_BUTTONS.filter((button) => button.id !== 'pause');

// The buttons a scene shows. A scene where players move sets `touchLayout` to 'onePlayer' or 'twoPlayers', or wraps a
// match scene that does. Every other scene is a menu and shows the menu buttons.
export function touchButtonsFor(scene) {
  const layout = scene.touchLayout ?? scene.matchScene?.touchLayout;
  if (layout === 'twoPlayers') return TWO_PLAYER_TOUCH_BUTTONS;
  if (layout === 'onePlayer') return TOUCH_BUTTONS;
  return MENU_TOUCH_BUTTONS;
}

// The portrait controls panel sits below the game and has its own pixels. One player, like the
// online scenes: every button fills the first player's record. The panel is CONTROLS_PANEL_WIDTH
// wide and as tall as the phone allows, so the layout takes its height. Buttons sit near the
// bottom, where thumbs rest.
const PANEL_EDGE_MARGIN = 4;
const PANEL_BOTTOM_MARGIN = 10;
// Left and right form one wide rocker on the left, each half 28% of the panel width.
const ROCKER_HALF_WIDTH = Math.round(CONTROLS_PANEL_WIDTH * 0.28);
const ROCKER_HEIGHT = 56;
// Shove and jump are large squares, 26% of the panel width, one above the other.
const ACTION_SIZE = Math.round(CONTROLS_PANEL_WIDTH * 0.26);
const ACTION_ROW_GAP = 4;
// Shove sits lower left of jump, so the two form a diagonal.
const SHOVE_OFFSET_LEFT = 16;
// Pause is small and tucked in the top right corner, away from the thumbs.
const PANEL_PAUSE = { id: 'pause', width: 28, height: 16, x: CONTROLS_PANEL_WIDTH - PANEL_EDGE_MARGIN - 28, y: 6 };

export function portraitTouchButtons(panelHeight) {
  const bottomY = panelHeight - PANEL_BOTTOM_MARGIN;
  const jumpX = CONTROLS_PANEL_WIDTH - PANEL_EDGE_MARGIN - ACTION_SIZE;
  const shoveY = bottomY - ACTION_SIZE;
  const rocker = { width: ROCKER_HALF_WIDTH, height: ROCKER_HEIGHT, y: bottomY - ROCKER_HEIGHT };
  const action = { width: ACTION_SIZE, height: ACTION_SIZE };
  return [
    { id: 'left', x: PANEL_EDGE_MARGIN, ...rocker },
    { id: 'right', x: PANEL_EDGE_MARGIN + ROCKER_HALF_WIDTH, ...rocker },
    { id: 'jump', x: jumpX, y: shoveY - ACTION_ROW_GAP - ACTION_SIZE, ...action },
    { id: 'action', x: jumpX - SHOVE_OFFSET_LEFT, y: shoveY, ...action },
    PANEL_PAUSE,
  ];
}

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
export function mapTouchesToInput(points, buttons = TOUCH_BUTTONS) {
  const pressed = pressedButtons(points, buttons).map((button) => button.id);
  return {
    left: pressed.includes('left'),
    right: pressed.includes('right'),
    jump: pressed.includes('jump'),
    up: false,
    down: false,
    action: pressed.includes('action'),
    confirm: pressed.includes('jump'),
    back: pressed.includes('action'),
    pause: pressed.includes('pause'),
  };
}

// Touch state only. A button with a playerId fills that player's record. Buttons without one fill the first
// player's. The game canvas gives points in game pixels. The
// optional controls canvas, the portrait panel below the game, gives points in its own pixels.
// sample and pressedButtons read the game points by default and the panel's when area is 'controls'.
export function createTouchInput(canvas, playerIds, controlsCanvas = null) {
  const pointsByArea = { game: [], controls: [] };
  let visible = false;

  function toPoint(touch, area) {
    const bounds = area === 'controls' ? controlsCanvas.getBoundingClientRect() : canvas.getBoundingClientRect();
    const logicalWidth = area === 'controls' ? controlsCanvas.width : SCREEN_WIDTH;
    const logicalHeight = area === 'controls' ? controlsCanvas.height : SCREEN_HEIGHT;
    return {
      x: ((touch.clientX - bounds.left) / bounds.width) * logicalWidth,
      y: ((touch.clientY - bounds.top) / bounds.height) * logicalHeight,
    };
  }

  function isShown(area) {
    const shownCanvas = area === 'controls' ? controlsCanvas : canvas;
    return shownCanvas.getBoundingClientRect().width > 0;
  }

  // Every finger on the screen counts for both areas, so a finger that started on one keeps its
  // button while it slides. Fingers outside an area land off its buttons.
  function updatePoints(event) {
    for (const area of Object.keys(pointsByArea)) {
      if (area === 'controls' && !controlsCanvas) continue;
      if (isShown(area)) pointsByArea[area] = Array.from(event.touches, (touch) => toPoint(touch, area));
    }
  }

  function onTouchStart(event) {
    visible = true;
    updatePoints(event);
  }

  for (const target of [canvas, controlsCanvas]) {
    if (!target) continue;
    target.addEventListener('touchstart', onTouchStart);
    target.addEventListener('touchmove', updatePoints);
    target.addEventListener('touchend', updatePoints);
    target.addEventListener('touchcancel', updatePoints);
  }

  return {
    get visible() {
      return visible;
    },
    pressedButtons(buttons = TOUCH_BUTTONS, area = 'game') {
      return pressedButtons(pointsByArea[area], buttons);
    },
    hide() {
      visible = false;
    },
    sample(buttons = TOUCH_BUTTONS, area = 'game') {
      const inputByPlayerId = {};
      for (const playerId of playerIds) {
        const playerButtons = buttons.filter((button) => (button.playerId ?? playerIds[0]) === playerId);
        inputByPlayerId[playerId] = mapTouchesToInput(pointsByArea[area], playerButtons);
      }
      return inputByPlayerId;
    },
  };
}
