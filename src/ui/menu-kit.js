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

// Draws a centered panel with one row per option, and returns the panel's bottom edge.
export function drawMenuList(context, { options, selectedIndex, topY }) {
  const { width, height } = menuPanelSize(options.map((option) => option.label));
  drawPanel(context, (SCREEN_WIDTH - width) / 2, topY, width, height);

  options.forEach((option, index) => {
    const isSelected = index === selectedIndex;
    const color = isSelected ? SELECTED_COLOR : UNSELECTED_COLOR;
    const rowTextY = topY + PANEL_PADDING_Y + index * ROW_HEIGHT + Math.floor((ROW_HEIGHT - GLYPH_HEIGHT) / 2);
    const textX = Math.floor((SCREEN_WIDTH - measureText(option.label) * BODY_SCALE) / 2);
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
