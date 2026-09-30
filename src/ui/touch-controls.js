import { TOUCH_BUTTONS } from '../engine/touch-input.js';
import { drawPanel } from './panel.js';
import { drawText } from './text.js';

const IDLE_ALPHA = 0.5;
const PRESSED_ALPHA = 0.85;
const PRESSED_COLOR = '#feae34';
const GLYPH_COLOR = '#c0cbdc';
const ARROW_DEPTH = 8;
const PAUSE_BAR_WIDTH = 4;
const PAUSE_BAR_HEIGHT = 16;
const PAUSE_BAR_GAP = 6;
const TEXT_HEIGHT = 5;

// An arrow is 2 * ARROW_DEPTH - 1 rows or columns of stepped length, so it stays crisp.
function drawArrow(context, centerX, centerY, direction) {
  const left = centerX - Math.floor(ARROW_DEPTH / 2);
  const top = centerY - Math.floor(ARROW_DEPTH / 2);
  for (let step = 0; step < ARROW_DEPTH * 2 - 1; step++) {
    const length = ARROW_DEPTH - Math.abs(step - (ARROW_DEPTH - 1));
    const offset = step - (ARROW_DEPTH - 1);
    if (direction === 'left') context.fillRect(left + ARROW_DEPTH - length, centerY + offset, length, 1);
    if (direction === 'right') context.fillRect(left, centerY + offset, length, 1);
    if (direction === 'up') context.fillRect(centerX + offset, top + ARROW_DEPTH - length, 1, length);
  }
}

function drawGlyph(context, button) {
  const centerX = button.x + button.width / 2;
  const centerY = button.y + button.height / 2;
  context.fillStyle = GLYPH_COLOR;
  if (button.id === 'pause') {
    const barY = centerY - PAUSE_BAR_HEIGHT / 2;
    context.fillRect(centerX - PAUSE_BAR_GAP / 2 - PAUSE_BAR_WIDTH, barY, PAUSE_BAR_WIDTH, PAUSE_BAR_HEIGHT);
    context.fillRect(centerX + PAUSE_BAR_GAP / 2, barY, PAUSE_BAR_WIDTH, PAUSE_BAR_HEIGHT);
  } else if (button.id === 'action') {
    drawText(context, 'Shove', centerX, centerY - Math.floor(TEXT_HEIGHT / 2), {
      scale: 1,
      align: 'center',
      color: GLYPH_COLOR,
      outlineColor: null,
    });
  } else {
    drawArrow(context, centerX, centerY, button.id === 'jump' ? 'up' : button.id);
  }
}

export function drawTouchControls(context, pressedButtonIds) {
  for (const button of TOUCH_BUTTONS) {
    const isPressed = pressedButtonIds.includes(button.id);
    context.globalAlpha = isPressed ? PRESSED_ALPHA : IDLE_ALPHA;
    drawPanel(context, button.x, button.y, button.width, button.height);
    if (isPressed) {
      context.fillStyle = PRESSED_COLOR;
      context.fillRect(button.x + 3, button.y + 3, button.width - 6, 2);
    }
    drawGlyph(context, button);
  }
  context.globalAlpha = 1;
}
