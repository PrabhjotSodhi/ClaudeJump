import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { drawText } from '../ui/text.js';
import { VersusScene } from './versus-scene.js';

const BACKGROUND_COLOR = '#141428';
const TITLE_Y = 30;
const TITLE_SCALE = 3;
const OPTIONS_TOP_Y = 80;
const OPTION_ROW_HEIGHT = 14;
const OPTIONS_LEFT_X = 150;
const SELECTED_OPTION_COLOR = '#ffdc28';
const SELECTION_MARKER_X = OPTIONS_LEFT_X - 10;
const SELECTION_MARKER_HEIGHT = 9;
const CONTROLS_TOP_Y = 130;
const CONTROLS_ROW_HEIGHT = 10;
const RED_COLOR = '#dc2828';
const BLUE_COLOR = '#2846dc';

// Survival goes here once it exists. The menu grows by one entry, nothing else changes.
export const MENU_OPTIONS = [{ id: 'versus', label: 'Versus' }];

export class TitleScene {
  constructor({ sceneManager, createSeed = () => Date.now(), options = MENU_OPTIONS } = {}) {
    this.sceneManager = sceneManager;
    this.createSeed = createSeed;
    this.options = options;
    this.selectedIndex = 0;
    this.waterLineY = SCREEN_HEIGHT;
    this.backgroundDrawn = false;
    this.previousDown = {};
    this.previousJump = {};
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
    if (option.id === 'versus') this.sceneManager.setScene(new VersusScene({ seed: this.createSeed() }));
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
  context.fillStyle = BACKGROUND_COLOR;
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

function drawTitleUi(context, scene) {
  drawText(context, 'ClaudeJump', SCREEN_WIDTH / 2, TITLE_Y, { scale: TITLE_SCALE, align: 'center' });

  scene.options.forEach((option, index) => {
    const y = OPTIONS_TOP_Y + index * OPTION_ROW_HEIGHT;
    const isSelected = index === scene.selectedIndex;
    drawText(context, option.label, OPTIONS_LEFT_X, y, {
      scale: 2,
      color: isSelected ? SELECTED_OPTION_COLOR : '#fff',
    });
    if (isSelected) drawSelectionMarker(context, y);
  });

  drawText(context, 'Red: A D move  W jump  C card', SCREEN_WIDTH / 2, CONTROLS_TOP_Y, {
    align: 'center',
    color: RED_COLOR,
  });
  drawText(context, 'Blue: Arrows move  Up jump  Comma card', SCREEN_WIDTH / 2, CONTROLS_TOP_Y + CONTROLS_ROW_HEIGHT, {
    align: 'center',
    color: BLUE_COLOR,
  });
}
