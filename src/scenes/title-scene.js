import { SCREEN_WIDTH } from '../engine/config.js';
import { EventEmitter } from '../engine/events.js';
import { saveKeyBindings } from '../engine/key-bindings.js';
import { saveSettings, settings } from '../engine/sound-settings.js';
import { drawArenaBackground } from '../levels/arena-backgrounds.js';
import { drawKeyHints, drawMenuList, drawWithMenuMotion, MenuMotion, MOVE_HINT, SELECT_HINT } from '../ui/menu-kit.js';
import { MenuInput, menuStep } from '../ui/menu-input.js';
import { SettingsMenu } from '../ui/settings-menu.js';
import { NO_WATER_LINE_Y } from '../ui/menu-screen.js';
import { drawText, TEXT_GLYPH_HEIGHT } from '../ui/text.js';
import { openOnlineMenu } from './online-flow.js';
import { PlayerSelectScene } from './player-select-scene.js';
import { SurvivalScene } from './survival-scene.js';
import { TitleBrawl } from './title-brawl.js';

const LOGO_TOP_LINE = 'LARGE LANGUAGE';
const LOGO_TOP_SCALE = 2;
const LOGO_BOTTOM_LINE = 'MAYHEM';
const LOGO_BOTTOM_SCALE = 3;
const LOGO_TOP_Y = 28;
const LOGO_LINE_GAP = 4;
// One line of up to 45 characters at 1x.
export const TAGLINE = 'Ignore all previous instructions and shove.';
const TAGLINE_COLOR = '#c0cbdc';
const TAGLINE_GAP = 8;
const LOGO_OUTLINE_COLOR = '#3e2731';
const LOGO_SHADOW_COLOR = '#181425';
const LOGO_BOB_PIXELS = 2;
const LOGO_BOB_PERIOD_SECONDS = 3;

const BACKGROUND_NAME = 'harbor';

const MENU_TOP_Y = 176;

const HINTS_Y = 284;
// The title is the first screen, so there is nothing to go back to.
const MENU_HINTS = [MOVE_HINT, SELECT_HINT];

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
  // initialInput seeds the held-key baseline from whatever opened this scene, so a press still held over from that
  // moment (such as confirming "Return to title" from the pause menu) does not immediately count as a fresh press here.
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
    this.menuInput = new MenuInput(initialInput);
  }

  update(inputByPlayerId) {
    this.menuMotion.update();
    this.brawl.update();

    if (this.settingsMenu) {
      if (this.settingsMenu.update(inputByPlayerId)) {
        this.settingsMenu = null;
        this.menuInput.hold(inputByPlayerId);
      }
      return;
    }

    const presses = this.menuInput.presses(inputByPlayerId);
    const step = menuStep(presses);
    if (step !== 0) {
      this.selectedIndex = (this.selectedIndex + step + this.options.length) % this.options.length;
      this.events.emit('menu-moved', {});
    }
    if (presses.confirm) {
      this.events.emit('menu-selected', {});
      this.menuMotion.press();
      this.confirmSelection(inputByPlayerId);
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
    const returnToTitle = (initialInput) =>
      this.sceneManager.setScene(
        new TitleScene({
          sceneManager: this.sceneManager,
          levels: this.levels,
          sprites: this.sprites,
          seed: this.seed,
          initialInput,
        }),
      );
    if (option.id === 'survival')
      this.sceneManager.setScene(new SurvivalScene({ sprites: this.sprites, seed: this.seed, returnToTitle }));
    if (option.id === 'online') {
      openOnlineMenu({
        sceneManager: this.sceneManager,
        levels: this.levels,
        sprites: this.sprites,
        seed: this.seed,
        returnToTitle,
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
    drawTitleUi(renderer.uiContext, this);
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
  const bottomLineY = y + TEXT_GLYPH_HEIGHT * LOGO_TOP_SCALE + LOGO_LINE_GAP;
  for (const [text, scale, lineY] of [
    [LOGO_TOP_LINE, LOGO_TOP_SCALE, y],
    [LOGO_BOTTOM_LINE, LOGO_BOTTOM_SCALE, bottomLineY],
  ]) {
    const options = { scale, align: 'center' };
    drawText(context, text, SCREEN_WIDTH / 2, lineY + 1, {
      ...options,
      color: LOGO_SHADOW_COLOR,
      outlineColor: LOGO_SHADOW_COLOR,
    });
    drawText(context, text, SCREEN_WIDTH / 2, lineY, { ...options, outlineColor: LOGO_OUTLINE_COLOR });
  }
  if (TAGLINE) {
    const taglineY = bottomLineY + TEXT_GLYPH_HEIGHT * LOGO_BOTTOM_SCALE + TAGLINE_GAP;
    drawText(context, TAGLINE, SCREEN_WIDTH / 2, taglineY, { scale: 1, align: 'center', color: TAGLINE_COLOR });
  }
}

function drawTitleUi(context, scene) {
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
    drawKeyHints(context, MENU_HINTS, HINTS_Y);
  });
}
