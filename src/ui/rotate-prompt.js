import { drawText } from './text.js';

// The rotate prompt has its own small portrait layout so it can be scaled up to fill a phone held upright.
export const ROTATE_PROMPT_WIDTH = 120;
export const ROTATE_PROMPT_HEIGHT = 160;

const BACKGROUND_COLOR = '#181425';
const TITLE_LINES = ['Turn your', 'phone', 'sideways'];
const TITLE_LINE_HEIGHT = 14;
const ICON_TO_TITLE_GAP = 16;
const TITLE_TO_BODY_GAP = 8;
const BODY_HEIGHT = 5;

export function drawRotatePrompt(context, iconCanvas) {
  context.fillStyle = BACKGROUND_COLOR;
  context.fillRect(0, 0, ROTATE_PROMPT_WIDTH, ROTATE_PROMPT_HEIGHT);

  const stackHeight =
    iconCanvas.height + ICON_TO_TITLE_GAP + TITLE_LINES.length * TITLE_LINE_HEIGHT + TITLE_TO_BODY_GAP + BODY_HEIGHT;
  const iconY = Math.floor((ROTATE_PROMPT_HEIGHT - stackHeight) / 2);
  context.imageSmoothingEnabled = false;
  context.drawImage(iconCanvas, Math.floor((ROTATE_PROMPT_WIDTH - iconCanvas.width) / 2), iconY);

  const titleY = iconY + iconCanvas.height + ICON_TO_TITLE_GAP;
  TITLE_LINES.forEach((line, lineIndex) => {
    drawText(context, line, ROTATE_PROMPT_WIDTH / 2, titleY + lineIndex * TITLE_LINE_HEIGHT, {
      scale: 2,
      align: 'center',
      color: '#feae34',
      outlineColor: BACKGROUND_COLOR,
    });
  });
  const bodyY = titleY + TITLE_LINES.length * TITLE_LINE_HEIGHT + TITLE_TO_BODY_GAP;
  drawText(context, 'Plays in landscape', ROTATE_PROMPT_WIDTH / 2, bodyY, {
    scale: 1,
    align: 'center',
    color: '#c0cbdc',
    outlineColor: BACKGROUND_COLOR,
  });
}
