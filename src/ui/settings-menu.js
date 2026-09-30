import { SCREEN_HEIGHT } from '../engine/config.js';
import { SCREEN_SHAKE_LEVELS, VOLUME_STEPS } from '../engine/sound-settings.js';
import {
  drawKeyHints,
  drawMenuList,
  drawMenuTitle,
  drawWithMenuMotion,
  KEYCAP_HEIGHT,
  MenuMotion,
  menuPanelSize,
  menuRowRectangles,
  rowIndexAt,
  tapPoint,
  TITLE_HEIGHT,
  wrapMenuIndex,
} from './menu-kit.js';
import { drawMenuBackdrop } from './menu-options.js';

const TITLE_GAP = 14;
const HINT_GAP = 14;
const HINTS = [
  { keys: ['Left', 'Right'], label: 'Change' },
  { keys: ['Esc', 'Start'], label: 'Back' },
];
const CONTROLS = ['up', 'down', 'left', 'right', 'confirm', 'pause'];

function capitalized(word) {
  return word[0].toUpperCase() + word.slice(1);
}

export function settingsMenuOptions(settings) {
  return [
    { id: 'musicVolume', label: `Music: ${settings.musicVolume}` },
    { id: 'effectsVolume', label: `Effects: ${settings.effectsVolume}` },
    { id: 'screenShake', label: `Screen shake: ${capitalized(settings.screenShake)}` },
    { id: 'reduceFlashes', label: `Reduce flashes: ${settings.reduceFlashes ? 'On' : 'Off'}` },
    { id: 'back', label: 'Back' },
  ];
}

// Moves one setting a step forward (1) or back (-1), wrapping at the ends.
export function changeSetting(settings, settingId, step) {
  if (settingId === 'musicVolume' || settingId === 'effectsVolume') {
    settings[settingId] = wrapMenuIndex(settings[settingId], step, VOLUME_STEPS + 1);
  } else if (settingId === 'screenShake') {
    const index = SCREEN_SHAKE_LEVELS.indexOf(settings.screenShake);
    settings.screenShake = SCREEN_SHAKE_LEVELS[wrapMenuIndex(index, step, SCREEN_SHAKE_LEVELS.length)];
  } else if (settingId === 'reduceFlashes') {
    settings.reduceFlashes = !settings.reduceFlashes;
  }
}

function settingsLayout(options) {
  const panelHeight = menuPanelSize(options.map((option) => option.label)).height;
  const stackHeight = TITLE_HEIGHT + TITLE_GAP + panelHeight + HINT_GAP + KEYCAP_HEIGHT;
  const titleY = Math.floor((SCREEN_HEIGHT - stackHeight) / 2);
  return { titleY, menuTopY: titleY + TITLE_HEIGHT + TITLE_GAP };
}

// The Settings screen, shown over a title or pause menu. It changes the settings object it is given
// and calls onChange after each change so the caller can save. Left and right change a row, confirm
// or a tap steps it forward, and pause or the Back row closes it. `initialInput` seeds the held-key
// baseline so the press that opened the screen does not act inside it.
export class SettingsMenu {
  constructor({ settings, events, onChange, initialInput = {} }) {
    this.settings = settings;
    this.events = events;
    this.onChange = onChange;
    this.selectedIndex = 0;
    this.motion = new MenuMotion();
    this.previous = {};
    for (const control of CONTROLS) {
      this.previous[control] = {};
      for (const playerId in initialInput) this.previous[control][playerId] = !!initialInput[playerId][control];
    }
  }

  get options() {
    return settingsMenuOptions(this.settings);
  }

  // Returns true on the tick the screen closes.
  update(inputByPlayerId) {
    this.motion.update();
    const pressed = {};
    for (const control of CONTROLS) pressed[control] = this.consumeFreshPress(inputByPlayerId, control);

    const options = this.options;
    const moved = (pressed.down ? 1 : 0) - (pressed.up ? 1 : 0);
    if (moved !== 0) {
      this.selectedIndex = wrapMenuIndex(this.selectedIndex, moved, options.length);
      this.events?.emit('menu-moved', {});
    }
    const tappedIndex = rowIndexAt(
      menuRowRectangles(
        options.map((option) => option.label),
        settingsLayout(options).menuTopY,
      ),
      tapPoint(inputByPlayerId),
    );
    if (tappedIndex >= 0) this.selectedIndex = tappedIndex;

    if (pressed.pause) return true;
    const step = (pressed.right ? 1 : 0) - (pressed.left ? 1 : 0) || (pressed.confirm || tappedIndex >= 0 ? 1 : 0);
    if (step === 0) return false;
    const settingId = options[this.selectedIndex].id;
    if (settingId === 'back') return pressed.confirm || tappedIndex >= 0;
    changeSetting(this.settings, settingId, step);
    this.onChange?.();
    this.events?.emit('menu-selected', {});
    this.motion.press();
    return false;
  }

  consumeFreshPress(inputByPlayerId, controlName) {
    let pressed = false;
    for (const playerId in inputByPlayerId) {
      const isDown = !!inputByPlayerId[playerId][controlName];
      if (isDown && !this.previous[controlName][playerId]) pressed = true;
      this.previous[controlName][playerId] = isDown;
    }
    return pressed;
  }

  render(context) {
    drawMenuBackdrop(context);
    const options = this.options;
    const { titleY, menuTopY } = settingsLayout(options);
    drawWithMenuMotion(context, this.motion, () => {
      drawMenuTitle(context, 'Settings', titleY);
      const panelBottomY = drawMenuList(context, {
        options,
        selectedIndex: this.selectedIndex,
        topY: menuTopY,
        motion: this.motion,
      });
      drawKeyHints(context, HINTS, panelBottomY + HINT_GAP);
    });
  }
}
