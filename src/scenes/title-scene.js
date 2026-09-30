import { SCREEN_WIDTH } from '../engine/config.js';
import { EventEmitter } from '../engine/events.js';
import { saveKeyBindings } from '../engine/key-bindings.js';
import { saveSettings, settings } from '../engine/sound-settings.js';
import { drawArenaBackground } from '../levels/arena-backgrounds.js';
import {
  drawKeyHints,
  drawMenuList,
  drawWithMenuMotion,
  MenuMotion,
  menuRowRectangles,
  rowIndexAt,
  tapPoint,
} from '../ui/menu-kit.js';
import { SettingsMenu } from '../ui/settings-menu.js';
import { NO_WATER_LINE_Y } from '../ui/menu-screen.js';
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

const MENU_TOP_Y = 168;

const TOUCH_HINT_TEXT = 'Tap a mode to play';
const TOUCH_HINT_Y = 246;

const HINTS_LABEL_COLOR = '#c0cbdc';
const HINTS_Y = 250;
const MENU_HINTS = [
  { keys: ['Up', 'Down'], pad: ['stick'], label: 'Choose' },
  { keys: ['Enter'], pad: ['south'], label: 'Select' },
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
  { id: 'settings', label: 'Settings' },
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
    this.settingsMenu = null;
    this.waterLineY = levels?.find((level) => level.background === BACKGROUND_NAME)?.waterLineY ?? NO_WATER_LINE_Y;
    this.brawl = new TitleBrawl({ seed, characterPoses: sprites?.characterPoses });
    this.backgroundDrawn = false;
    this.previous = { up: {}, down: {}, confirm: {} };
    for (const playerId in initialInput) {
      for (const control in this.previous) this.previous[control][playerId] = !!initialInput[playerId][control];
    }
  }

  update(inputByPlayerId) {
    this.menuMotion.update();
    this.brawl.update();

    if (this.settingsMenu) {
      if (this.settingsMenu.update(inputByPlayerId)) {
        this.settingsMenu = null;
        this.holdCurrentInput(inputByPlayerId);
      }
      return;
    }

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
      this.confirmSelection(inputByPlayerId);
    }
  }

  // Whatever is held now, such as the confirm that closed the Settings screen, must be released before it counts again.
  holdCurrentInput(inputByPlayerId) {
    for (const playerId in inputByPlayerId) {
      for (const control in this.previous) this.previous[control][playerId] = !!inputByPlayerId[playerId][control];
    }
  }

  confirmSelection(inputByPlayerId) {
    const option = this.options[this.selectedIndex];
    if (option.id === 'settings') {
      this.settingsMenu = new SettingsMenu({
        settings,
        events: this.events,
        onChange: () => this.saveSettings(),
        initialInput: inputByPlayerId,
      });
    }
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

  saveSettings() {
    const storage = this.sceneManager?.soundPlayer?.storage;
    if (!storage) return;
    saveSettings(storage, settings);
    saveKeyBindings(storage);
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
    this.settingsMenu?.render(renderer.uiContext);
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
  if (scene.settingsMenu) return;
  drawWithMenuMotion(context, scene.menuMotion, () => {
    drawMenuList(context, {
      options: scene.options,
      selectedIndex: scene.selectedIndex,
      topY: MENU_TOP_Y,
      motion: scene.menuMotion,
    });
    if (touchActive) drawTouchHint(context);
    else drawKeyHints(context, MENU_HINTS, HINTS_Y);
  });
}
