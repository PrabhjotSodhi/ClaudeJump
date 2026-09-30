import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { DEFAULT_CHARACTER_BY_PLAYER_ID } from '../entities/characters.js';
import { drawArenaBackground } from '../levels/arena-backgrounds.js';
import { PLAYERS } from '../levels/versus-arena.js';
import { drawKeyHints, drawMenuList, KEYCAP_HEIGHT, menuRowRectangles, rowIndexAt, tapPoint } from '../ui/menu-kit.js';
import { NO_WATER_LINE_Y } from '../ui/menu-screen.js';
import { drawPanel } from '../ui/panel.js';
import { drawText } from '../ui/text.js';
import { drawCharacterBody, FRAME_SIZE } from '../vfx/character-body.js';
import { EYE_STIFFNESSES, GooglyEye } from '../vfx/googly-eyes.js';
import { PlayerSelectScene } from './player-select-scene.js';
import { SurvivalScene } from './survival-scene.js';

const LOGO_TEXT = 'ClaudeJump';
const LOGO_SCALE = 3;
const LOGO_TOP_Y = 36;
const LOGO_OUTLINE_COLOR = '#3e2731';
const LOGO_SHADOW_COLOR = '#181425';
const LOGO_BOB_PIXELS = 2;
const LOGO_BOB_PERIOD_SECONDS = 3;

const BACKGROUND_NAME = 'harbor';
const LEDGE_TOP_Y = 130;
const LEDGE_BLOCK_SIZE = 32;
const LEDGE_BLOCK_GAP = 2;
const LEDGE_BLOCK_SPRITE_NAMES = ['block-big-0', 'block-big-1', 'block-big-0'];
const LEDGE_BLOCK_STRIDE = LEDGE_BLOCK_SIZE + LEDGE_BLOCK_GAP;
const LEDGE_WIDTH = LEDGE_BLOCK_SPRITE_NAMES.length * LEDGE_BLOCK_STRIDE - LEDGE_BLOCK_GAP;
const LEDGE_LEFT_X = (SCREEN_WIDTH - LEDGE_WIDTH) / 2;
// The white outline row of each body overlaps the top edge of its block so the feet read as touching.
const CHARACTER_SINK_PIXELS = 1;
const LEDGE_STANDERS = [
  { playerId: 'red', blockIndex: 0 },
  { playerId: 'blue', blockIndex: 2 },
];

const MENU_TOP_Y = 176;

const HINTS_PANEL_WIDTH = 300;
const HINTS_PANEL_TOP_Y = 250;
const HINTS_PANEL_PADDING = 8;
const HINTS_ROW_HEIGHT = 14;
const HINTS_LABEL_COLOR = '#c0cbdc';
const RED_COLOR = PLAYERS.find((spawn) => spawn.id === 'red').color;
const BLUE_COLOR = PLAYERS.find((spawn) => spawn.id === 'blue').color;
const KEY_HINT_ROWS = [
  {
    label: 'Red',
    color: RED_COLOR,
    hints: [
      { keys: ['A', 'D'], label: 'Move' },
      { keys: ['W'], label: 'Jump' },
      { keys: ['S'], label: 'Shove' },
    ],
  },
  {
    label: 'Blue',
    color: BLUE_COLOR,
    hints: [
      { keys: ['Left', 'Right'], label: 'Move' },
      { keys: ['Up'], label: 'Jump' },
      { keys: ['Down'], label: 'Shove' },
    ],
  },
  {
    label: 'Pad',
    color: HINTS_LABEL_COLOR,
    hints: [
      { keys: ['Stick'], label: 'Move' },
      { keys: ['A'], label: 'Jump' },
      { keys: ['B'], label: 'Shove' },
    ],
  },
  {
    label: 'Menu',
    color: HINTS_LABEL_COLOR,
    hints: [
      { keys: ['Up', 'Down'], label: 'Choose' },
      { keys: ['Enter', 'A'], label: 'Select' },
    ],
  },
];

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

export const MENU_OPTIONS = [
  { id: 'versus', label: 'Versus' },
  { id: 'survival', label: 'Survival' },
];

export class TitleScene {
  // initialInput seeds the held-key baseline from whatever opened this scene, so an up, down or
  // confirm press still held over from that moment (such as confirming "Return to title" from the
  // pause menu) does not immediately count as a fresh press here.
  constructor({ sceneManager, levels, sprites, seed = Date.now(), options = MENU_OPTIONS, initialInput = {} } = {}) {
    this.sceneManager = sceneManager;
    this.levels = levels;
    this.sprites = sprites;
    this.seed = seed;
    this.options = options;
    this.selectedIndex = 0;
    this.waterLineY = levels?.find((level) => level.background === BACKGROUND_NAME)?.waterLineY ?? NO_WATER_LINE_Y;
    this.eyesByPlayerId = {};
    for (const { playerId } of LEDGE_STANDERS) {
      this.eyesByPlayerId[playerId] = EYE_STIFFNESSES.map((stiffness) => new GooglyEye(stiffness));
    }
    this.backgroundDrawn = false;
    this.previous = { up: {}, down: {}, confirm: {} };
    for (const playerId in initialInput) {
      for (const control in this.previous) this.previous[control][playerId] = !!initialInput[playerId][control];
    }
  }

  update(inputByPlayerId) {
    for (const eyes of Object.values(this.eyesByPlayerId)) for (const eye of eyes) eye.update(0, 0);

    const pressed = { up: false, down: false, confirm: false };
    for (const playerId in inputByPlayerId) {
      const input = inputByPlayerId[playerId];
      for (const control in pressed) {
        if (input[control] && !this.previous[control][playerId]) pressed[control] = true;
        this.previous[control][playerId] = !!input[control];
      }
    }

    const optionCount = this.options.length;
    if (pressed.down) this.selectedIndex = (this.selectedIndex + 1) % optionCount;
    if (pressed.up) this.selectedIndex = (this.selectedIndex + optionCount - 1) % optionCount;
    const tappedIndex = rowIndexAt(
      menuRowRectangles(
        this.options.map((option) => option.label),
        MENU_TOP_Y,
      ),
      tapPoint(inputByPlayerId),
    );
    if (tappedIndex >= 0) this.selectedIndex = tappedIndex;
    if (pressed.confirm || tappedIndex >= 0) this.confirmSelection();
  }

  confirmSelection() {
    const option = this.options[this.selectedIndex];
    if (option.id === 'survival')
      this.sceneManager.setScene(new SurvivalScene({ sprites: this.sprites, seed: this.seed }));
    if (option.id === 'versus')
      this.sceneManager.setScene(
        new PlayerSelectScene({
          sceneManager: this.sceneManager,
          levels: this.levels,
          sprites: this.sprites,
          seed: this.seed,
        }),
      );
  }

  render(renderer) {
    if (!this.backgroundDrawn) {
      renderer.updateBackground((context) => drawArenaBackground(context, BACKGROUND_NAME));
      this.backgroundDrawn = true;
    }

    renderer.clearGameLayer();
    renderer.clearUiLayer();
    drawLedgeAndCharacters(renderer.gameContext, this);
    drawTitleUi(renderer.uiContext, this);
  }
}

function drawLedgeAndCharacters(context, scene) {
  LEDGE_BLOCK_SPRITE_NAMES.forEach((spriteName, index) => {
    context.drawImage(scene.sprites.stoneBlocks[spriteName], LEDGE_LEFT_X + index * LEDGE_BLOCK_STRIDE, LEDGE_TOP_Y);
  });

  for (const { playerId, blockIndex } of LEDGE_STANDERS) {
    const character = DEFAULT_CHARACTER_BY_PLAYER_ID[playerId];
    const sprite = scene.sprites[character.spriteName].body;
    drawCharacterBody(context, {
      sprite,
      eyeFramePositions: character.eyeFramePositions,
      eyes: scene.eyesByPlayerId[playerId],
      centerX: LEDGE_LEFT_X + blockIndex * LEDGE_BLOCK_STRIDE + LEDGE_BLOCK_SIZE / 2,
      bottomY: LEDGE_TOP_Y + bottomPaddingRows(sprite) + CHARACTER_SINK_PIXELS,
      width: FRAME_SIZE,
      height: FRAME_SIZE,
    });
  }
}

const bottomPaddingRowsBySprite = new Map();

// The empty rows under a sprite's lowest opaque pixel, so the feet rest exactly on the ledge top.
function bottomPaddingRows(sprite) {
  if (!bottomPaddingRowsBySprite.has(sprite)) {
    const canvas = document.createElement('canvas');
    canvas.width = sprite.width;
    canvas.height = sprite.height;
    const context = canvas.getContext('2d');
    context.drawImage(sprite, 0, 0);
    const pixels = context.getImageData(0, 0, sprite.width, sprite.height).data;
    let lowestOpaqueRow = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] > 0) lowestOpaqueRow = Math.floor(index / 4 / sprite.width);
    }
    bottomPaddingRowsBySprite.set(sprite, sprite.height - 1 - lowestOpaqueRow);
  }
  return bottomPaddingRowsBySprite.get(sprite);
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

// The bob follows the wall clock. It is render only, so no game state depends on it.
function drawLogo(context) {
  const phase = (performance.now() / 1000 / LOGO_BOB_PERIOD_SECONDS) * 2 * Math.PI;
  const y = LOGO_TOP_Y + Math.round(Math.sin(phase) * LOGO_BOB_PIXELS);
  const options = { scale: LOGO_SCALE, align: 'center' };
  drawText(context, LOGO_TEXT, SCREEN_WIDTH / 2, y + 1, {
    ...options,
    color: LOGO_SHADOW_COLOR,
    outlineColor: LOGO_SHADOW_COLOR,
  });
  drawText(context, LOGO_TEXT, SCREEN_WIDTH / 2, y, { ...options, outlineColor: LOGO_OUTLINE_COLOR });
}

function drawKeyHintPanel(context) {
  const height = (KEY_HINT_ROWS.length - 1) * HINTS_ROW_HEIGHT + KEYCAP_HEIGHT + 2 * HINTS_PANEL_PADDING;
  const left = (SCREEN_WIDTH - HINTS_PANEL_WIDTH) / 2;
  drawPanel(context, left, HINTS_PANEL_TOP_Y, HINTS_PANEL_WIDTH, height);
  KEY_HINT_ROWS.forEach(({ label, color, hints }, index) => {
    const y = HINTS_PANEL_TOP_Y + HINTS_PANEL_PADDING + index * HINTS_ROW_HEIGHT;
    drawText(context, label, left + HINTS_PANEL_PADDING, y + 3, { scale: 1, color, outlineColor: null });
    drawKeyHints(context, hints, y);
  });
}

function drawTitleUi(context, scene) {
  drawLogo(context);
  drawFullscreenButton(context);
  drawMenuList(context, { options: scene.options, selectedIndex: scene.selectedIndex, topY: MENU_TOP_Y });
  drawKeyHintPanel(context);
}
