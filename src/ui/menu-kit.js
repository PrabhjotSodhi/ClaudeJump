import { SCREEN_WIDTH } from '../engine/config.js';
import { getInputDevice, getPadType } from '../engine/input-device.js';
import { boundCode, keyName } from '../engine/key-bindings.js';
import { PLAYERS } from '../levels/versus-arena.js';
import { drawGlyph, GLYPH_SIZE, padGlyphName } from './hint-glyphs.js';
import { drawText, measureText } from './text.js';

const TITLE_SCALE = 3;
const BODY_SCALE = 1;
const GLYPH_HEIGHT = 5;
const ROW_HEIGHT = 14;
const PANEL_PADDING_X = 16;
const PANEL_PADDING_Y = 8;
const OPTION_SCALE = 2;
const SELECTED_OPTION_SCALE = 3;
export const MENU_ROW_HEIGHT = 24;
const POINTER_GAP = 6;
const SCROLL_MARK_SIZE = 3;
const SELECTED_COLOR = '#feae34';
const UNSELECTED_COLOR = '#c0cbdc';
const OPTION_OUTLINE_COLOR = '#3e2731';

// Tune numbers for menu motion, all in ticks and whole pixels.
export const MENU_SLIDE_TICKS = 10;
export const MENU_SLIDE_DISTANCE = 32;
export const MENU_BOB_HALF_PERIOD_TICKS = 24;
// Extra pixels the selected plate is squashed by on each tick after a press. The plate gets wider and shorter.
export const MENU_PRESS_SQUASH_PIXELS = [2, 2, 1, 1, 1, 1];

const KEYCAP_PADDING_X = 3;
const KEYCAP_PADDING_Y = 2;
const KEYCAP_BORDER_COLOR = '#181425';
const KEYCAP_FILL_COLOR = '#3a4466';
const KEYCAP_HIGHLIGHT_COLOR = '#5a6988';
const KEY_GAP = 2;
const KEY_LABEL_GAP = 4;
const HINT_GAP = 12;
export const HINT_ROW_HEIGHT = 14;

export const TITLE_HEIGHT = GLYPH_HEIGHT * TITLE_SCALE;

// The hints every shared menu shows, built from the same three: move, select and back.
export const MOVE_HINT = { keys: ['Arrows'], pad: ['stick'], label: 'Move' };
export const SELECT_HINT = { keys: ['Enter'], pad: ['south'], label: 'Select' };
export const BACK_HINT = { keys: ['Esc'], pad: ['east'], label: 'Back' };
export const MENU_HINTS = [MOVE_HINT, SELECT_HINT, BACK_HINT];

// The hint rows of a screen where each player has a seat: one row per keyboard player with their own keys, and one
// for pads. confirmLabel names what jump does there, such as 'Vote'.
export function seatHintRows(confirmLabel) {
  const keyboardRow = (playerId) => ({
    label: `${playerId[0].toUpperCase()}${playerId.slice(1)}`,
    device: 'keyboard',
    color: PLAYERS.find((spawn) => spawn.id === playerId).color,
    hints: [
      {
        keys: [
          { player: playerId, control: 'left' },
          { player: playerId, control: 'right' },
        ],
        label: 'Pick',
      },
      { keys: [{ player: playerId, control: 'jump' }], label: confirmLabel },
      { keys: [{ player: playerId, control: 'action' }], label: 'Back' },
    ],
  });
  return [
    keyboardRow('red'),
    keyboardRow('blue'),
    {
      label: 'Pads',
      device: 'pad',
      color: UNSELECTED_COLOR,
      hints: [
        { keys: [], pad: ['stick'], label: 'Pick' },
        { keys: [], pad: ['south'], label: confirmLabel },
        { keys: [], pad: ['east'], label: 'Back' },
      ],
    },
  ];
}
export const KEYCAP_HEIGHT = GLYPH_HEIGHT + 2 * KEYCAP_PADDING_Y + 2;

// The panel fits its widest row plus padding on both sides. Its width is kept even so the text
// and the panel both center on whole pixels.
export function menuPanelSize(labels) {
  const widestLabel = Math.max(...labels.map((label) => measureText(label) * BODY_SCALE));
  const width = Math.ceil((widestLabel + 2 * PANEL_PADDING_X) / 2) * 2;
  return { width, height: labels.length * ROW_HEIGHT + 2 * PANEL_PADDING_Y };
}

// How tall a menu list of this many options is, showing at most maxRows of them.
export function menuListHeight(optionCount, maxRows = optionCount) {
  return Math.min(optionCount, maxRows) * MENU_ROW_HEIGHT;
}

// Panels slide up into place over MENU_SLIDE_TICKS, easing out, and slide back down when closed.
export function slideInOffset(ticksSinceOpen) {
  const remaining = 1 - Math.min(Math.max(ticksSinceOpen, 0), MENU_SLIDE_TICKS) / MENU_SLIDE_TICKS;
  return Math.round(MENU_SLIDE_DISTANCE * remaining * remaining);
}

export function slideOutOffset(ticksSinceClose) {
  const elapsed = Math.min(Math.max(ticksSinceClose, 0), MENU_SLIDE_TICKS) / MENU_SLIDE_TICKS;
  return Math.round(MENU_SLIDE_DISTANCE * elapsed * elapsed);
}

// The selected label rises one pixel and drops again, forever.
export function bobOffset(tick) {
  return Math.floor(tick / MENU_BOB_HALF_PERIOD_TICKS) % 2 === 0 ? 0 : -1;
}

export function pressSquashPixels(ticksSincePress) {
  return MENU_PRESS_SQUASH_PIXELS[ticksSincePress] ?? 0;
}

// The motion of one menu, driven by ticks. Call update() every tick, press() when the player
// chooses something and close() when the menu leaves. It never blocks input: a press during a
// slide still counts because the scene handles input as usual.
export class MenuMotion {
  // Pass `{ closed: true }` for a menu that starts hidden and opens later with a new MenuMotion.
  constructor({ closed = false } = {}) {
    this.tick = 0;
    this.ticksSincePress = null;
    this.ticksSinceClose = closed ? MENU_SLIDE_TICKS : null;
  }

  update() {
    this.tick++;
    if (this.ticksSincePress !== null) this.ticksSincePress++;
    if (this.ticksSinceClose !== null) this.ticksSinceClose++;
  }

  press() {
    this.ticksSincePress = 0;
  }

  close() {
    if (this.ticksSinceClose === null) this.ticksSinceClose = 0;
  }

  get offsetY() {
    return this.ticksSinceClose === null ? slideInOffset(this.tick) : slideOutOffset(this.ticksSinceClose);
  }

  get isClosed() {
    return this.ticksSinceClose !== null && this.ticksSinceClose >= MENU_SLIDE_TICKS;
  }

  get squashPixels() {
    return this.ticksSincePress === null ? 0 : pressSquashPixels(this.ticksSincePress);
  }
}

// Runs draw with everything shifted by the menu's slide offset.
export function drawWithMenuMotion(context, motion, draw) {
  context.save();
  context.translate(0, motion.offsetY);
  draw();
  context.restore();
}

export function wrapMenuIndex(index, step, count) {
  return (((index + step) % count) + count) % count;
}

export function drawMenuTitle(context, title, y) {
  drawText(context, title, SCREEN_WIDTH / 2, y, { scale: TITLE_SCALE, align: 'center' });
}

// A right pointing triangle as tall as text at this scale, with an outline like the text's. Returns its width.
export function drawPointer(context, x, y, scale, color) {
  const height = GLYPH_HEIGHT * scale;
  const width = Math.ceil(height / 2);
  for (const [fillColor, grow] of [
    [OPTION_OUTLINE_COLOR, 1],
    [color, 0],
  ]) {
    context.fillStyle = fillColor;
    for (let column = 0; column < width; column++) {
      context.fillRect(x + column - grow, y + column - grow, 1 + 2 * grow, height - 2 * column + 2 * grow);
    }
  }
  return width;
}

// A small triangle above or below a list that has more options out of view that way.
function drawScrollMark(context, centerX, y, pointingUp) {
  context.fillStyle = UNSELECTED_COLOR;
  for (let row = 0; row < SCROLL_MARK_SIZE; row++) {
    const halfWidth = pointingUp ? row : SCROLL_MARK_SIZE - 1 - row;
    context.fillRect(centerX - halfWidth - 1, y + row, halfWidth * 2 + 2, 1);
  }
}

// Draws one centered row per option as outlined text straight on the scene, and returns the list's bottom edge. The
// selected option is bigger, in the selected color, with a pointer, and bobs; a press nudges its pointer. With fewer
// maxRows than options, the rows shown scroll to keep the selection in view.
export function drawMenuList(context, { options, selectedIndex, topY, motion, maxRows = options.length }) {
  const rowCount = Math.min(options.length, maxRows);
  const firstIndex = Math.max(0, Math.min(selectedIndex - Math.floor(rowCount / 2), options.length - rowCount));
  for (let row = 0; row < rowCount; row++) {
    const index = firstIndex + row;
    const isSelected = index === selectedIndex;
    const scale = isSelected ? SELECTED_OPTION_SCALE : OPTION_SCALE;
    const color = isSelected ? SELECTED_COLOR : UNSELECTED_COLOR;
    const label = options[index].label;
    const textWidth = measureText(label) * scale;
    const textX = Math.floor((SCREEN_WIDTH - textWidth) / 2);
    const bob = isSelected ? bobOffset(motion.tick) : 0;
    const textY = topY + row * MENU_ROW_HEIGHT + Math.floor((MENU_ROW_HEIGHT - GLYPH_HEIGHT * scale) / 2) + bob;
    drawText(context, label, textX, textY, { scale, color, outlineColor: OPTION_OUTLINE_COLOR });
    if (isSelected) {
      const pointerWidth = Math.ceil((GLYPH_HEIGHT * scale) / 2);
      drawPointer(context, textX - POINTER_GAP - pointerWidth + motion.squashPixels, textY, scale, color);
    }
  }
  if (firstIndex > 0) drawScrollMark(context, SCREEN_WIDTH / 2, topY - SCROLL_MARK_SIZE - 1, true);
  if (firstIndex + rowCount < options.length) {
    drawScrollMark(context, SCREEN_WIDTH / 2, topY + rowCount * MENU_ROW_HEIGHT + 1, false);
  }
  return topY + rowCount * MENU_ROW_HEIGHT;
}

function keycapWidth(keyName) {
  return measureText(keyName) + 2 * KEYCAP_PADDING_X + 2;
}

function drawKeycap(context, keyName, x, y) {
  const width = keycapWidth(keyName);
  context.fillStyle = KEYCAP_BORDER_COLOR;
  context.fillRect(x, y, width, KEYCAP_HEIGHT);
  context.fillStyle = KEYCAP_FILL_COLOR;
  context.fillRect(x + 1, y + 1, width - 2, KEYCAP_HEIGHT - 2);
  context.fillStyle = KEYCAP_HIGHLIGHT_COLOR;
  context.fillRect(x + 1, y + 1, width - 2, 1);
  drawText(context, keyName, x + 1 + KEYCAP_PADDING_X, y + 1 + KEYCAP_PADDING_Y, {
    scale: BODY_SCALE,
    color: UNSELECTED_COLOR,
    outlineColor: null,
  });
  return width;
}

// What one hint shows for a device: keyboard key names as text, pad buttons as glyph names in the
// symbols of the pad type, and nothing for touch, which has its own buttons on screen.
// A key is a name to show as it is, or { player, control } to show the key that player has bound.
// A hint without `pad` shows its keys on a pad.
export function hintItems(hint, device, padType = 'generic') {
  if (device === 'touch') return [];
  if (device === 'pad' && hint.pad) return hint.pad.map((glyph) => ({ glyph: padGlyphName(glyph, padType) }));
  return hint.keys.map((key) => ({
    text: typeof key === 'string' ? key : keyName(boundCode(key.player, key.control)),
  }));
}

// The hint rows for a device. A row with a `device` shows only for that device, other rows always show.
export function rowsForDevice(rows, device) {
  return rows.filter((row) => !row.device || row.device === device);
}

function itemWidth(item) {
  return item.glyph ? GLYPH_SIZE : keycapWidth(item.text);
}

function hintWidth(items, label) {
  const itemsWidth = items.reduce((total, item) => total + itemWidth(item), 0) + (items.length - 1) * KEY_GAP;
  return itemsWidth + KEY_LABEL_GAP + measureText(label) * BODY_SCALE;
}

// Each hint is { keys: ['Enter'], pad: ['south'], label: 'Select' }: one icon per key, then the label.
// The keys show for the keyboard and `pad` for a gamepad, following whichever device sent input
// last. Touch shows no hints.
export function drawKeyHints(context, hints, y) {
  const device = getInputDevice();
  if (device === 'touch') return;
  const shown = hints.map((hint) => ({ items: hintItems(hint, device, getPadType()), label: hint.label }));
  const totalWidth =
    shown.reduce((total, { items, label }) => total + hintWidth(items, label), 0) + (shown.length - 1) * HINT_GAP;
  let x = Math.floor((SCREEN_WIDTH - totalWidth) / 2);
  for (const { items, label } of shown) {
    items.forEach((item, index) => {
      if (index > 0) x += KEY_GAP;
      if (item.glyph) {
        drawGlyph(context, item.glyph, x, y + Math.floor((KEYCAP_HEIGHT - GLYPH_SIZE) / 2));
        x += GLYPH_SIZE;
      } else {
        x += drawKeycap(context, item.text, x, y);
      }
    });
    x += KEY_LABEL_GAP;
    drawText(context, label, x, y + 1 + KEYCAP_PADDING_Y, {
      scale: BODY_SCALE,
      color: UNSELECTED_COLOR,
      outlineColor: OPTION_OUTLINE_COLOR,
    });
    x += measureText(label) * BODY_SCALE + HINT_GAP;
  }
}

// One row of hints per entry in `rows`, each { label, color, hints }, with the label on the left, straight on the
// scene. Rows with a `device` show only for that device, so touch shows none.
export function drawKeyHintRows(context, rows, { topY, width }) {
  const device = getInputDevice();
  const shownRows = device === 'touch' ? [] : rowsForDevice(rows, device);
  const left = (SCREEN_WIDTH - width) / 2;
  shownRows.forEach(({ label, color, hints }, index) => {
    const y = topY + index * HINT_ROW_HEIGHT;
    drawText(context, label, left, y + 1 + KEYCAP_PADDING_Y, {
      scale: BODY_SCALE,
      color,
      outlineColor: OPTION_OUTLINE_COLOR,
    });
    drawKeyHints(context, hints, y);
  });
}
