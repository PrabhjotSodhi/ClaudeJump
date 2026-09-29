import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { PLAYERS } from '../levels/versus-arena.js';
import { MENU_BACKGROUND_COLOR, NO_WATER_LINE_Y } from '../ui/menu-screen.js';
import { drawText } from '../ui/text.js';
import { PlayerSelectScene } from './player-select-scene.js';

const TITLE_Y = 60;
const TITLE_SCALE = 6;
const OPTIONS_TOP_Y = 160;
const OPTION_ROW_HEIGHT = 28;
const OPTIONS_LEFT_X = 300;
const SELECTED_OPTION_COLOR = '#ffdc28';
const SELECTION_MARKER_X = OPTIONS_LEFT_X - 20;
const SELECTION_MARKER_HEIGHT = 18;
const CONTROLS_TOP_Y = 260;
const CONTROLS_ROW_HEIGHT = 20;
const RED_COLOR = PLAYERS.find((spawn) => spawn.id === 'red').color;
const BLUE_COLOR = PLAYERS.find((spawn) => spawn.id === 'blue').color;

const FULLSCREEN_BUTTON_SIZE = 28;
const FULLSCREEN_BUTTON_MARGIN = 12;
const FULLSCREEN_BUTTON_ARM_LENGTH = 10;
// Bottom-right corner button, in screen pixels, that main.js hit-tests a click against to
// toggle fullscreen. Kept as data here so drawing and hit-testing never drift apart.
export const FULLSCREEN_BUTTON = {
  x: SCREEN_WIDTH - FULLSCREEN_BUTTON_MARGIN - FULLSCREEN_BUTTON_SIZE,
  y: SCREEN_HEIGHT - FULLSCREEN_BUTTON_MARGIN - FULLSCREEN_BUTTON_SIZE,
  width: FULLSCREEN_BUTTON_SIZE,
  height: FULLSCREEN_BUTTON_SIZE,
};

// Survival goes here once it exists. The menu grows by one entry, nothing else changes.
export const MENU_OPTIONS = [{ id: 'versus', label: 'Versus' }];

export class TitleScene {
  // initialInput seeds the held-key baseline from whatever opened this scene, so a jump or down
  // press still held over from that moment (such as confirming "Return to title" from the pause
  // menu) does not immediately count as a fresh press here.
  constructor({ sceneManager, level, seed = Date.now(), options = MENU_OPTIONS, initialInput = {} } = {}) {
    this.sceneManager = sceneManager;
    this.level = level;
    this.seed = seed;
    this.options = options;
    this.selectedIndex = 0;
    this.waterLineY = NO_WATER_LINE_Y;
    this.backgroundDrawn = false;
    this.previousDown = {};
    this.previousJump = {};
    for (const playerId in initialInput) {
      this.previousDown[playerId] = !!initialInput[playerId].down;
      this.previousJump[playerId] = !!initialInput[playerId].jump;
    }
  }

  update(inputByPlayerId) {
    let downPressed = false;
    let jumpPressed = false;
    for (const playerId in inputByPlayerId) {
      const input = inputByPlayerId[playerId];
      if (input.down && !this.previousDown[playerId]) downPressed = true;
      if (input.jump && !this.previousJump[playerId]) jumpPressed = true;
      this.previousDown[playerId] = input.down;
      this.previousJump[playerId] = input.jump;
    }

    if (downPressed) this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
    if (jumpPressed) this.confirmSelection();
  }

  confirmSelection() {
    const option = this.options[this.selectedIndex];
    if (option.id === 'versus')
      this.sceneManager.setScene(
        new PlayerSelectScene({ sceneManager: this.sceneManager, level: this.level, seed: this.seed }),
      );
  }

  render(renderer) {
    if (!this.backgroundDrawn) {
      renderer.updateBackground((context) => drawTitleBackground(context));
      this.backgroundDrawn = true;
    }

    renderer.clearGameLayer();
    renderer.clearUiLayer();
    drawTitleUi(renderer.uiContext, this);
  }
}

function drawTitleBackground(context) {
  context.fillStyle = MENU_BACKGROUND_COLOR;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
}

// A crisp right-pointing triangle beside the selected option, built from whole pixels.
function drawSelectionMarker(context, textTopY) {
  context.fillStyle = SELECTED_OPTION_COLOR;
  const rowCount = SELECTION_MARKER_HEIGHT;
  for (let row = 0; row < rowCount; row++) {
    const distanceFromCenter = Math.abs(row - (rowCount - 1) / 2);
    const width = Math.ceil(rowCount / 2 - distanceFromCenter);
    context.fillRect(SELECTION_MARKER_X, textTopY + row, width, 1);
  }
}

// Four corner brackets, the common shorthand for a fullscreen toggle, so no new art is needed.
function drawFullscreenButton(context) {
  const { x, y, width, height } = FULLSCREEN_BUTTON;
  context.strokeStyle = '#fff';
  context.lineWidth = 3;
  for (const [cornerX, cornerY, directionX, directionY] of [
    [x, y, 1, 1],
    [x + width, y, -1, 1],
    [x, y + height, 1, -1],
    [x + width, y + height, -1, -1],
  ]) {
    context.beginPath();
    context.moveTo(cornerX + directionX * FULLSCREEN_BUTTON_ARM_LENGTH, cornerY);
    context.lineTo(cornerX, cornerY);
    context.lineTo(cornerX, cornerY + directionY * FULLSCREEN_BUTTON_ARM_LENGTH);
    context.stroke();
  }
}

function drawTitleUi(context, scene) {
  drawText(context, 'ClaudeJump', SCREEN_WIDTH / 2, TITLE_Y, { scale: TITLE_SCALE, align: 'center' });
  drawFullscreenButton(context);

  scene.options.forEach((option, index) => {
    const y = OPTIONS_TOP_Y + index * OPTION_ROW_HEIGHT;
    const isSelected = index === scene.selectedIndex;
    drawText(context, option.label, OPTIONS_LEFT_X, y, {
      scale: 4,
      color: isSelected ? SELECTED_OPTION_COLOR : '#fff',
    });
    if (isSelected) drawSelectionMarker(context, y);
  });

  drawText(context, 'Red: A D move  W jump  C shove', SCREEN_WIDTH / 2, CONTROLS_TOP_Y, {
    align: 'center',
    color: RED_COLOR,
  });
  drawText(context, 'Blue: Arrows move  Up jump  Comma shove', SCREEN_WIDTH / 2, CONTROLS_TOP_Y + CONTROLS_ROW_HEIGHT, {
    align: 'center',
    color: BLUE_COLOR,
  });
}
