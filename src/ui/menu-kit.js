import { SCREEN_WIDTH } from '../engine/config.js';
import { drawPanel } from './panel.js';
import { drawText, measureText } from './text.js';

const TITLE_SCALE = 2;
const BODY_SCALE = 1;
const GLYPH_HEIGHT = 5;
const ROW_HEIGHT = 14;
const PANEL_PADDING_X = 16;
const PANEL_PADDING_Y = 8;
const MARKER_WIDTH = 3;
const MARKER_GAP = 4;
const SELECTED_COLOR = '#feae34';
const UNSELECTED_COLOR = '#c0cbdc';

const PLATE_COLOR = '#3a4466';
const PLATE_MARGIN = 2;
const PLATE_GROW_PIXELS = 2;
const PLATE_INSET_Y = 1;

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

export const TITLE_HEIGHT = GLYPH_HEIGHT * TITLE_SCALE;
export const KEYCAP_HEIGHT = GLYPH_HEIGHT + 2 * KEYCAP_PADDING_Y + 2;

// The panel fits its widest row plus padding on both sides. Its width is kept even so the text
// and the panel both center on whole pixels.
export function menuPanelSize(labels) {
  const widestLabel = Math.max(...labels.map((label) => measureText(label) * BODY_SCALE));
  const width = Math.ceil((widestLabel + 2 * PANEL_PADDING_X) / 2) * 2;
  return { width, height: labels.length * ROW_HEIGHT + 2 * PANEL_PADDING_Y };
}

// One rectangle per option, spanning the panel, for tapping a row.
export function menuRowRectangles(labels, topY) {
  const { width } = menuPanelSize(labels);
  return labels.map((label, index) => ({
    x: (SCREEN_WIDTH - width) / 2,
    y: topY + PANEL_PADDING_Y + index * ROW_HEIGHT,
    width,
    height: ROW_HEIGHT,
  }));
}

// The row index at a point, or -1.
export function rowIndexAt(rectangles, point) {
  if (!point) return -1;
  return rectangles.findIndex(
    (rectangle) =>
      point.x >= rectangle.x &&
      point.x < rectangle.x + rectangle.width &&
      point.y >= rectangle.y &&
      point.y < rectangle.y + rectangle.height,
  );
}

// The tap of whichever player touched this tick, or null.
export function tapPoint(inputByPlayerId) {
  return Object.values(inputByPlayerId).find((input) => input.tap)?.tap ?? null;
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
  constructor() {
    this.tick = 0;
    this.ticksSincePress = null;
    this.ticksSinceClose = null;
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

function drawSelectionMarker(context, x, y, color) {
  context.fillStyle = color;
  for (let column = 0; column < MARKER_WIDTH; column++) {
    context.fillRect(x + column, y + column, 1, GLYPH_HEIGHT - 2 * column);
  }
}

// The selected row sits on a plate that is one step wider than its text. A press squashes it.
function drawSelectedPlate(context, { left, right, rowY, squashPixels }) {
  const x = left - PLATE_GROW_PIXELS - squashPixels;
  const width = right - left + 2 * (PLATE_GROW_PIXELS + squashPixels);
  const y = rowY + PLATE_INSET_Y + squashPixels;
  const height = ROW_HEIGHT - 2 * (PLATE_INSET_Y + squashPixels);
  context.fillStyle = PLATE_COLOR;
  context.fillRect(x, y, width, height);
}

// Draws a centered panel with one row per option, and returns the panel's bottom edge.
export function drawMenuList(context, { options, selectedIndex, topY, motion }) {
  const { width, height } = menuPanelSize(options.map((option) => option.label));
  drawPanel(context, (SCREEN_WIDTH - width) / 2, topY, width, height);

  options.forEach((option, index) => {
    const isSelected = index === selectedIndex;
    const color = isSelected ? SELECTED_COLOR : UNSELECTED_COLOR;
    const rowY = topY + PANEL_PADDING_Y + index * ROW_HEIGHT;
    const textWidth = measureText(option.label) * BODY_SCALE;
    const textX = Math.floor((SCREEN_WIDTH - textWidth) / 2);
    if (isSelected) {
      drawSelectedPlate(context, {
        left: textX - MARKER_GAP - MARKER_WIDTH - PLATE_MARGIN,
        right: textX + textWidth + PLATE_MARGIN,
        rowY,
        squashPixels: motion.squashPixels,
      });
    }
    const bob = isSelected ? bobOffset(motion.tick) : 0;
    const rowTextY = rowY + Math.floor((ROW_HEIGHT - GLYPH_HEIGHT) / 2) + bob;
    drawText(context, option.label, textX, rowTextY, { scale: BODY_SCALE, color, outlineColor: null });
    if (isSelected) drawSelectionMarker(context, textX - MARKER_GAP - MARKER_WIDTH, rowTextY, color);
  });
  return topY + height;
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

function hintWidth({ keys, label }) {
  const keysWidth = keys.reduce((total, keyName) => total + keycapWidth(keyName), 0) + (keys.length - 1) * KEY_GAP;
  return keysWidth + KEY_LABEL_GAP + measureText(label) * BODY_SCALE;
}

// Each hint is { keys: ['Enter', 'A'], label: 'Select' }: one keycap per key, then the label.
// List keyboard and gamepad keys together so both kinds of player read the same row.
export function drawKeyHints(context, hints, y) {
  const totalWidth = hints.reduce((total, hint) => total + hintWidth(hint), 0) + (hints.length - 1) * HINT_GAP;
  let x = Math.floor((SCREEN_WIDTH - totalWidth) / 2);
  for (const hint of hints) {
    hint.keys.forEach((keyName, index) => {
      if (index > 0) x += KEY_GAP;
      x += drawKeycap(context, keyName, x, y);
    });
    x += KEY_LABEL_GAP;
    drawText(context, hint.label, x, y + 1 + KEYCAP_PADDING_Y, {
      scale: BODY_SCALE,
      color: UNSELECTED_COLOR,
      outlineColor: null,
    });
    x += measureText(hint.label) * BODY_SCALE + HINT_GAP;
  }
}
