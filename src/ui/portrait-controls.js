import { drawGlyph, fittingArrowScale } from './touch-controls.js';
import { drawText } from './text.js';

const BORDER_COLOR = '#3e2731';
const PANEL_COLOR = '#181425';
const PANEL_HIGHLIGHT_COLOR = '#262b44';
const BUTTON_COLOR = '#3a4466';
const BUTTON_LIGHT_COLOR = '#5a6988';
const BUTTON_SHADOW_COLOR = '#262b44';
const LABEL_COLOR = '#8b9bb4';
const ARROW_FILL = 0.75;
const LABEL_TEXT_HEIGHT = 5;
const GLYPH_COLOR = '#c0cbdc';
const PRESSED_COLOR = '#feae34';
const PRESSED_GLYPH_COLOR = '#3e2731';

function drawFrame(context, width, height) {
  context.fillStyle = BORDER_COLOR;
  context.fillRect(0, 0, width, height);
  context.fillStyle = PANEL_COLOR;
  context.fillRect(1, 1, width - 2, height - 2);
  context.fillStyle = PANEL_HIGHLIGHT_COLOR;
  context.fillRect(1, 1, width - 2, 1);
}

// A raised button: outline with cut corners, light top left edge, dark bottom right edge. A pressed
// button turns orange and loses its edges.
function drawButton(context, button, isPressed) {
  const { x, y, width, height } = button;
  context.fillStyle = BORDER_COLOR;
  context.fillRect(x + 1, y, width - 2, height);
  context.fillRect(x, y + 1, width, height - 2);
  context.fillStyle = isPressed ? PRESSED_COLOR : BUTTON_COLOR;
  context.fillRect(x + 1, y + 1, width - 2, height - 2);
  if (isPressed) return;
  context.fillStyle = BUTTON_LIGHT_COLOR;
  context.fillRect(x + 2, y + 1, width - 4, 1);
  context.fillRect(x + 1, y + 2, 1, height - 4);
  context.fillStyle = BUTTON_SHADOW_COLOR;
  context.fillRect(x + 2, y + height - 2, width - 4, 1);
  context.fillRect(x + width - 2, y + 2, 1, height - 4);
}

// The wordmark sits centered in the empty band between the pause button and the top of the thumb buttons.
function labelY(buttons) {
  const pause = buttons.find((button) => button.id === 'pause');
  const pauseBottom = pause.y + pause.height;
  const buttonsTop = Math.min(...buttons.filter((button) => button.id !== 'pause').map((button) => button.y));
  return Math.round((pauseBottom + buttonsTop - LABEL_TEXT_HEIGHT) / 2);
}

// Draws the controls panel onto its own canvas, so it never covers the game. buttons is the panel
// layout and pressedButtons the buttons under a finger. showPause hides pause in scenes that cannot pause.
export function drawPortraitControls(context, { width, height, buttons, pressedButtons, showPause }) {
  drawFrame(context, width, height);
  drawText(context, 'Large Language Mayhem', width / 2, labelY(buttons), {
    scale: 1,
    align: 'center',
    color: LABEL_COLOR,
    outlineColor: null,
  });
  for (const button of buttons) {
    if (button.id === 'pause' && !showPause) continue;
    const isPressed = pressedButtons.includes(button);
    drawButton(context, button, isPressed);
    drawGlyph(
      context,
      button,
      isPressed ? PRESSED_GLYPH_COLOR : GLYPH_COLOR,
      fittingArrowScale(button.height, ARROW_FILL),
    );
  }
}
