import { PLAYERS } from '../levels/versus-arena.js';
import { drawText } from './text.js';

const OUTLINE_COLOR = '#c0cbdc';
const PRESSED_COLOR = '#feae34';
const IDLE_FILL_ALPHA = 0.1;
const PRESSED_FILL_ALPHA = 0.4;
const OUTLINE_ALPHA = 0.55;
// A button fades to this fraction of its look while a player's body is behind it.
const OVERLAP_FADE = 0.2;
const ARROW_DEPTH = 8;
const PAUSE_BAR_WIDTH = 3;
const PAUSE_BAR_HEIGHT = 10;
const PAUSE_BAR_GAP = 4;
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

function drawGlyph(context, button, color) {
  const centerX = button.x + button.width / 2;
  const centerY = button.y + button.height / 2;
  context.fillStyle = color;
  if (button.id === 'pause') {
    const barY = centerY - PAUSE_BAR_HEIGHT / 2;
    context.fillRect(centerX - PAUSE_BAR_GAP / 2 - PAUSE_BAR_WIDTH, barY, PAUSE_BAR_WIDTH, PAUSE_BAR_HEIGHT);
    context.fillRect(centerX + PAUSE_BAR_GAP / 2, barY, PAUSE_BAR_WIDTH, PAUSE_BAR_HEIGHT);
  } else if (button.id === 'action') {
    drawText(context, 'Shove', centerX, centerY - Math.floor(TEXT_HEIGHT / 2), {
      scale: 1,
      align: 'center',
      color,
      outlineColor: null,
    });
  } else {
    drawArrow(context, centerX, centerY, button.id === 'jump' ? 'up' : button.id);
  }
}

function overlaps(button, rectangle) {
  return (
    rectangle.x < button.x + button.width &&
    rectangle.x + rectangle.width > button.x &&
    rectangle.y < button.y + button.height &&
    rectangle.y + rectangle.height > button.y
  );
}

// A player's buttons take that player's color.
function buttonColor(button) {
  return PLAYERS.find((player) => player.id === button.playerId)?.color ?? OUTLINE_COLOR;
}

// buttons is the layout in use and pressed the buttons under a finger. playerRectangles are the
// players' bodies in screen pixels. showPause hides the pause button in scenes that cannot pause.
export function drawTouchControls(context, { buttons, pressedButtons, playerRectangles, showPause }) {
  for (const button of buttons) {
    if (button.id === 'pause' && !showPause) continue;
    const fade = playerRectangles.some((rectangle) => overlaps(button, rectangle)) ? OVERLAP_FADE : 1;
    const isPressed = pressedButtons.includes(button);
    const color = buttonColor(button);

    context.globalAlpha = (isPressed ? PRESSED_FILL_ALPHA : IDLE_FILL_ALPHA) * fade;
    context.fillStyle = isPressed ? PRESSED_COLOR : color;
    context.fillRect(button.x, button.y, button.width, button.height);

    context.globalAlpha = OUTLINE_ALPHA * fade;
    context.fillStyle = color;
    context.fillRect(button.x, button.y, button.width, 1);
    context.fillRect(button.x, button.y + button.height - 1, button.width, 1);
    context.fillRect(button.x, button.y + 1, 1, button.height - 2);
    context.fillRect(button.x + button.width - 1, button.y + 1, 1, button.height - 2);

    drawGlyph(context, button, color);
  }
  context.globalAlpha = 1;
}
