import { SCREEN_HEIGHT } from '../engine/config.js';
import { SCREEN_SHAKE_LEVELS, VOLUME_STEPS } from '../engine/sound-settings.js';
import {
  drawKeyHints,
  drawMenuList,
  drawMenuTitle,
  drawWithMenuMotion,
  KEYCAP_HEIGHT,
  MENU_HINTS,
  menuListHeight,
  MenuMotion,
  TITLE_HEIGHT,
  wrapMenuIndex,
} from './menu-kit.js';
import { MenuInput, menuStep } from './menu-input.js';
import { ControlsMenu } from './controls-menu.js';
import { drawMenuBackdrop } from './menu-options.js';

const TITLE_GAP = 14;
const HINT_GAP = 14;

function capitalized(word) {
  return word[0].toUpperCase() + word.slice(1);
}

export function settingsMenuOptions(settings) {
  return [
    { id: 'musicVolume', label: `Music: ${settings.musicVolume}` },
    { id: 'effectsVolume', label: `Effects: ${settings.effectsVolume}` },
    { id: 'screenShake', label: `Screen shake: ${capitalized(settings.screenShake)}` },
    { id: 'reduceFlashes', label: `Reduce flashes: ${settings.reduceFlashes ? 'On' : 'Off'}` },
    { id: 'controls', label: 'Controls' },
    { id: 'back', label: 'Back' },
  ];
}

// Moves one setting a step forward (1) or back (-1), wrapping at the ends, so a confirm on a full volume mutes it.
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
  const panelHeight = menuListHeight(options.length);
  const stackHeight = TITLE_HEIGHT + TITLE_GAP + panelHeight + HINT_GAP + KEYCAP_HEIGHT;
  const titleY = Math.floor((SCREEN_HEIGHT - stackHeight) / 2);
  return { titleY, menuTopY: titleY + TITLE_HEIGHT + TITLE_GAP };
}

// The Settings screen, shown over a title or pause menu. It changes the settings object it is given and calls onChange
// after each change so the caller can save. Confirm steps the selected row forward (or opens Controls), and back or the
// Back row closes it. `initialInput` seeds the held-key baseline so the press that opened the screen does not act
// inside it.
export class SettingsMenu {
  constructor({ settings, events, onChange, initialInput = {} }) {
    this.settings = settings;
    this.events = events;
    this.onChange = onChange;
    this.selectedIndex = 0;
    this.controlsMenu = null;
    this.motion = new MenuMotion();
    this.menuInput = new MenuInput(initialInput);
  }

  get options() {
    return settingsMenuOptions(this.settings);
  }

  // Returns true on the tick the screen closes.
  update(inputByPlayerId) {
    this.motion.update();
    if (this.controlsMenu) {
      if (this.controlsMenu.update(inputByPlayerId)) {
        this.controlsMenu = null;
        this.menuInput.hold(inputByPlayerId);
      }
      return false;
    }

    const presses = this.menuInput.presses(inputByPlayerId);
    const options = this.options;
    const step = menuStep(presses);
    if (step !== 0) {
      this.selectedIndex = wrapMenuIndex(this.selectedIndex, step, options.length);
      this.events?.emit('menu-moved', {});
    }
    if (presses.back) return true;
    if (!presses.confirm) return false;
    const settingId = options[this.selectedIndex].id;
    if (settingId === 'back') return true;
    this.events?.emit('menu-selected', {});
    this.motion.press();
    if (settingId === 'controls') {
      this.controlsMenu = new ControlsMenu({
        events: this.events,
        onChange: this.onChange,
        initialInput: inputByPlayerId,
      });
      return false;
    }
    changeSetting(this.settings, settingId, 1);
    this.onChange?.();
    return false;
  }

  render(context) {
    if (this.controlsMenu) {
      this.controlsMenu.render(context);
      return;
    }
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
      drawKeyHints(context, MENU_HINTS, panelBottomY + HINT_GAP);
    });
  }
}
