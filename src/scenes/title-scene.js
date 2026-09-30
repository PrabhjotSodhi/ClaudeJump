import { SCREEN_WIDTH } from '../engine/config.js';
import { getInputDevice } from '../engine/input-device.js';
import { EventEmitter } from '../engine/events.js';
import { drawArenaBackground } from '../levels/arena-backgrounds.js';
import { PLAYERS } from '../levels/versus-arena.js';
import {
  drawKeyHints,
  rowsForDevice,
  drawMenuList,
  drawWithMenuMotion,
  KEYCAP_HEIGHT,
  MenuMotion,
  menuRowRectangles,
  rowIndexAt,
  tapPoint,
} from '../ui/menu-kit.js';
import { NO_WATER_LINE_Y } from '../ui/menu-screen.js';
import { drawPanel } from '../ui/panel.js';
import { drawText } from '../ui/text.js';
import { openOnlineMenu } from './online-flow.js';
import { PlayerSelectScene } from './player-select-scene.js';
import { SurvivalScene } from './survival-scene.js';
import { TitleBrawl } from './title-brawl.js';

const LOGO_TEXT = 'ClaudeJump';
const LOGO_SCALE = 3;
const LOGO_TOP_Y = 36;
const LOGO_OUTLINE_COLOR = '#3e2731';
const LOGO_SHADOW_COLOR = '#181425';
const LOGO_BOB_PIXELS = 2;
const LOGO_BOB_PERIOD_SECONDS = 3;

const BACKGROUND_NAME = 'harbor';

const MENU_TOP_Y = 176;

const TOUCH_HINT_TEXT = 'Tap a mode to play';
const TOUCH_HINT_Y = 240;

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
    device: 'keyboard',
    color: RED_COLOR,
    hints: [
      { keys: ['A', 'D'], label: 'Move' },
      { keys: ['W'], label: 'Jump' },
      { keys: ['S'], label: 'Shove' },
    ],
  },
  {
    label: 'Blue',
    device: 'keyboard',
    color: BLUE_COLOR,
    hints: [
      { keys: ['Left', 'Right'], label: 'Move' },
      { keys: ['Up'], label: 'Jump' },
      { keys: ['Down'], label: 'Shove' },
    ],
  },
  {
    label: 'Pad',
    device: 'pad',
    color: HINTS_LABEL_COLOR,
    hints: [
      { keys: ['Stick'], pad: ['stick'], label: 'Move' },
      { keys: ['A'], pad: ['south'], label: 'Jump' },
      { keys: ['B'], pad: ['east'], label: 'Shove' },
    ],
  },
  {
    label: 'Menu',
    color: HINTS_LABEL_COLOR,
    hints: [
      { keys: ['Up', 'Down'], pad: ['stick'], label: 'Choose' },
      { keys: ['Enter'], pad: ['south'], label: 'Select' },
    ],
  },
];

const FULLSCREEN_BUTTON_SIZE = 28;
const FULLSCREEN_BUTTON_MARGIN = 12;
const FULLSCREEN_BUTTON_ARM_LENGTH = 10;
// Top-right corner button, in screen pixels, that main.js hit-tests a click against to
// toggle fullscreen. Kept as data here so drawing and hit-testing never drift apart.
export const FULLSCREEN_BUTTON = {
  x: SCREEN_WIDTH - FULLSCREEN_BUTTON_MARGIN - FULLSCREEN_BUTTON_SIZE,
  y: FULLSCREEN_BUTTON_MARGIN,
  width: FULLSCREEN_BUTTON_SIZE,
  height: FULLSCREEN_BUTTON_SIZE,
};

export const MENU_OPTIONS = [
  { id: 'versus', label: 'Versus' },
  { id: 'survival', label: 'Survival' },
  { id: 'online', label: 'Online' },
];

export class TitleScene {
  // initialInput seeds the held-key baseline from whatever opened this scene, so an up, down or
  // confirm press still held over from that moment (such as confirming "Return to title" from the
  // pause menu) does not immediately count as a fresh press here.
  constructor({ sceneManager, levels, sprites, seed = Date.now(), options = MENU_OPTIONS, initialInput = {} } = {}) {
    this.sceneManager = sceneManager;
    this.events = new EventEmitter();
    this.musicTrackName = 'menu';
    this.levels = levels;
    this.sprites = sprites;
    this.seed = seed;
    this.options = options;
    this.selectedIndex = 0;
    this.menuMotion = new MenuMotion();
    this.waterLineY = levels?.find((level) => level.background === BACKGROUND_NAME)?.waterLineY ?? NO_WATER_LINE_Y;
    this.brawl = new TitleBrawl({ seed });
    this.backgroundDrawn = false;
    this.previous = { up: {}, down: {}, confirm: {} };
    for (const playerId in initialInput) {
      for (const control in this.previous) this.previous[control][playerId] = !!initialInput[playerId][control];
    }
  }

  update(inputByPlayerId) {
    this.menuMotion.update();
    this.brawl.update();

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
    if (pressed.down || pressed.up) this.events.emit('menu-moved', {});
    if (pressed.confirm || tappedIndex >= 0) {
      this.events.emit('menu-selected', {});
      this.menuMotion.press();
      this.confirmSelection();
    }
  }

  confirmSelection() {
    const option = this.options[this.selectedIndex];
    if (option.id === 'survival')
      this.sceneManager.setScene(new SurvivalScene({ sprites: this.sprites, seed: this.seed }));
    if (option.id === 'online') {
      openOnlineMenu({
        sceneManager: this.sceneManager,
        levels: this.levels,
        sprites: this.sprites,
        seed: this.seed,
        returnToTitle: (initialInput) =>
          this.sceneManager.setScene(
            new TitleScene({
              sceneManager: this.sceneManager,
              levels: this.levels,
              sprites: this.sprites,
              seed: this.seed,
              initialInput,
            }),
          ),
      });
    }
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
    this.brawl.render(renderer.gameContext, this.sprites);
    drawTitleUi(renderer.uiContext, this, renderer.touchActive);
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
  const rows = rowsForDevice(KEY_HINT_ROWS, getInputDevice());
  if (rows.length === 0) return;
  const height = (rows.length - 1) * HINTS_ROW_HEIGHT + KEYCAP_HEIGHT + 2 * HINTS_PANEL_PADDING;
  const left = (SCREEN_WIDTH - HINTS_PANEL_WIDTH) / 2;
  drawPanel(context, left, HINTS_PANEL_TOP_Y, HINTS_PANEL_WIDTH, height);
  rows.forEach(({ label, color, hints }, index) => {
    const y = HINTS_PANEL_TOP_Y + HINTS_PANEL_PADDING + index * HINTS_ROW_HEIGHT;
    drawText(context, label, left + HINTS_PANEL_PADDING, y + 3, { scale: 1, color, outlineColor: null });
    drawKeyHints(context, hints, y);
  });
}

function drawTouchHint(context) {
  drawText(context, TOUCH_HINT_TEXT, SCREEN_WIDTH / 2, TOUCH_HINT_Y, {
    scale: 1,
    align: 'center',
    color: HINTS_LABEL_COLOR,
    outlineColor: LOGO_OUTLINE_COLOR,
  });
}

function drawTitleUi(context, scene, touchActive) {
  drawLogo(context);
  if (scene.sceneManager?.fullscreen?.supported) drawFullscreenButton(context);
  drawWithMenuMotion(context, scene.menuMotion, () => {
    drawMenuList(context, {
      options: scene.options,
      selectedIndex: scene.selectedIndex,
      topY: MENU_TOP_Y,
      motion: scene.menuMotion,
    });
    if (touchActive) drawTouchHint(context);
    else drawKeyHintPanel(context);
  });
}
