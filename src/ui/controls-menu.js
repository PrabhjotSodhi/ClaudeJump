import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import {
  assignKey,
  boundCode,
  keyCapture,
  keyName,
  REMAPPABLE_CONTROLS,
  resetKeyBindings,
} from '../engine/key-bindings.js';
import {
  BACK_HINT,
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
import { drawMenuBackdrop } from './menu-options.js';
import { drawText } from './text.js';

const TITLE_GAP = 10;
const MESSAGE_GAP = 6;
const MESSAGE_HEIGHT = 5;
const HINT_GAP = 6;
const REFUSED_COLOR = '#e43b44';
const WAITING_HINTS = [{ ...BACK_HINT, keys: ['Esc'], label: 'Cancel' }];
// More rows than fit on screen, so the list scrolls.
const VISIBLE_ROWS = 7;
const KEYBOARD_PLAYER_IDS = ['red', 'blue'];

function capitalized(word) {
  return word[0].toUpperCase() + word.slice(1);
}

// One row per remappable key, then Reset and Back. `waiting` is the row that waits for a key.
export function controlsMenuOptions(waiting = null) {
  const options = [];
  for (const playerId of KEYBOARD_PLAYER_IDS) {
    for (const control of REMAPPABLE_CONTROLS) {
      const isWaiting = waiting?.playerId === playerId && waiting.control === control;
      const value = isWaiting ? 'Press a key' : keyName(boundCode(playerId, control));
      options.push({ id: 'key', playerId, control, label: `${capitalized(playerId)} ${control}: ${value}` });
    }
  }
  options.push({ id: 'reset', label: 'Reset to defaults' });
  options.push({ id: 'back', label: 'Back' });
  return options;
}

function controlsLayout(options) {
  const panelHeight = menuListHeight(options.length, VISIBLE_ROWS);
  const stackHeight = TITLE_HEIGHT + TITLE_GAP + panelHeight + MESSAGE_GAP + MESSAGE_HEIGHT + HINT_GAP + KEYCAP_HEIGHT;
  const titleY = Math.floor((SCREEN_HEIGHT - stackHeight) / 2);
  return { titleY, menuTopY: titleY + TITLE_HEIGHT + TITLE_GAP };
}

// The Controls screen: one row per keyboard key of red and blue. Choosing a row waits for a key and
// assigns it, unless another control already has it. It changes the live key bindings and calls
// onChange after each change so the caller can save. Back or the Back row closes it, and while it
// waits, back or Escape cancels the wait. `initialInput` seeds the held-key baseline so the press that
// opened the screen does not act inside it.
export class ControlsMenu {
  constructor({ events, onChange, initialInput = {} }) {
    this.events = events;
    this.onChange = onChange;
    this.selectedIndex = 0;
    this.waiting = null;
    this.message = '';
    this.motion = new MenuMotion();
    this.menuInput = new MenuInput(initialInput);
  }

  get options() {
    return controlsMenuOptions(this.waiting);
  }

  // Returns true on the tick the screen closes.
  update(inputByPlayerId) {
    this.motion.update();
    const presses = this.menuInput.presses(inputByPlayerId);

    if (this.waiting) {
      this.updateWaiting(presses);
      return false;
    }

    const options = this.options;
    const step = menuStep(presses);
    if (step !== 0) {
      this.selectedIndex = wrapMenuIndex(this.selectedIndex, step, options.length);
      this.events?.emit('menu-moved', {});
    }

    if (presses.back) return true;
    if (!presses.confirm) return false;
    const option = options[this.selectedIndex];
    if (option.id === 'back') return true;
    this.events?.emit('menu-selected', {});
    this.motion.press();
    this.message = '';
    if (option.id === 'reset') {
      resetKeyBindings();
      this.onChange?.();
    } else {
      this.waiting = { playerId: option.playerId, control: option.control };
      keyCapture.start();
    }
    return false;
  }

  updateWaiting(presses) {
    const code = keyCapture.take();
    if (presses.back || code === 'Escape') {
      this.stopWaiting();
      return;
    }
    if (code === null) return;
    const result = assignKey(this.waiting.playerId, this.waiting.control, code);
    this.message = result.ok ? '' : result.message;
    if (result.ok) this.onChange?.();
    this.stopWaiting();
  }

  stopWaiting() {
    this.waiting = null;
    keyCapture.stop();
  }

  render(context) {
    drawMenuBackdrop(context);
    const options = this.options;
    const { titleY, menuTopY } = controlsLayout(options);
    drawWithMenuMotion(context, this.motion, () => {
      drawMenuTitle(context, 'Controls', titleY);
      const panelBottomY = drawMenuList(context, {
        options,
        selectedIndex: this.selectedIndex,
        topY: menuTopY,
        motion: this.motion,
        maxRows: VISIBLE_ROWS,
      });
      const messageY = panelBottomY + MESSAGE_GAP;
      drawText(context, this.message, SCREEN_WIDTH / 2, messageY, {
        scale: 1,
        align: 'center',
        color: REFUSED_COLOR,
        outlineColor: null,
      });
      drawKeyHints(context, this.waiting ? WAITING_HINTS : MENU_HINTS, messageY + MESSAGE_HEIGHT + HINT_GAP);
    });
  }
}
