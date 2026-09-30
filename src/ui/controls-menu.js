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
import { drawText } from './text.js';

const TITLE_GAP = 10;
const MESSAGE_GAP = 6;
const MESSAGE_HEIGHT = 5;
const HINT_GAP = 6;
const REFUSED_COLOR = '#e43b44';
const HINTS = [
  { keys: ['Enter'], pad: ['south'], label: 'Change' },
  { keys: ['Esc', 'Start'], label: 'Back' },
];
const WAITING_HINTS = [{ keys: ['Esc'], label: 'Cancel' }];
const CONTROLS = ['up', 'down', 'confirm', 'pause'];
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
  const panelHeight = menuPanelSize(options.map((option) => option.label)).height;
  const stackHeight = TITLE_HEIGHT + TITLE_GAP + panelHeight + MESSAGE_GAP + MESSAGE_HEIGHT + HINT_GAP + KEYCAP_HEIGHT;
  const titleY = Math.floor((SCREEN_HEIGHT - stackHeight) / 2);
  return { titleY, menuTopY: titleY + TITLE_HEIGHT + TITLE_GAP };
}

// The Controls screen: one row per keyboard key of red and blue. Choosing a row waits for a key and
// assigns it, unless another control already has it. It changes the live key bindings and calls
// onChange after each change so the caller can save. Pause or the Back row closes it, and while it
// waits, pause cancels the wait. `initialInput` seeds the held-key baseline so the press that
// opened the screen does not act inside it.
export class ControlsMenu {
  constructor({ events, onChange, initialInput = {} }) {
    this.events = events;
    this.onChange = onChange;
    this.selectedIndex = 0;
    this.waiting = null;
    this.message = '';
    this.motion = new MenuMotion();
    this.previous = {};
    for (const control of CONTROLS) {
      this.previous[control] = {};
      for (const playerId in initialInput) this.previous[control][playerId] = !!initialInput[playerId][control];
    }
  }

  get options() {
    return controlsMenuOptions(this.waiting);
  }

  // Returns true on the tick the screen closes.
  update(inputByPlayerId) {
    this.motion.update();
    const pressed = {};
    for (const control of CONTROLS) pressed[control] = this.consumeFreshPress(inputByPlayerId, control);

    if (this.waiting) {
      this.updateWaiting(pressed);
      return false;
    }

    const options = this.options;
    const moved = (pressed.down ? 1 : 0) - (pressed.up ? 1 : 0);
    if (moved !== 0) {
      this.selectedIndex = wrapMenuIndex(this.selectedIndex, moved, options.length);
      this.events?.emit('menu-moved', {});
    }
    const tappedIndex = rowIndexAt(
      menuRowRectangles(
        options.map((option) => option.label),
        controlsLayout(options).menuTopY,
      ),
      tapPoint(inputByPlayerId),
    );
    if (tappedIndex >= 0) this.selectedIndex = tappedIndex;

    if (pressed.pause) return true;
    if (!pressed.confirm && tappedIndex < 0) return false;
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

  updateWaiting(pressed) {
    const code = keyCapture.take();
    if (pressed.pause || code === 'Escape') {
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
    const { titleY, menuTopY } = controlsLayout(options);
    drawWithMenuMotion(context, this.motion, () => {
      drawMenuTitle(context, 'Controls', titleY);
      const panelBottomY = drawMenuList(context, {
        options,
        selectedIndex: this.selectedIndex,
        topY: menuTopY,
        motion: this.motion,
      });
      const messageY = panelBottomY + MESSAGE_GAP;
      drawText(context, this.message, SCREEN_WIDTH / 2, messageY, {
        scale: 1,
        align: 'center',
        color: REFUSED_COLOR,
        outlineColor: null,
      });
      drawKeyHints(context, this.waiting ? WAITING_HINTS : HINTS, messageY + MESSAGE_HEIGHT + HINT_GAP);
    });
  }
}
