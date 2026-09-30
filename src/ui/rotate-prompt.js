import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { drawText } from './text.js';

const OUTLINE_COLOR = '#181425';
const ICON_TO_TITLE_GAP = 16;
const TITLE_TO_BODY_GAP = 12;
const TITLE_HEIGHT = 20;
const BODY_HEIGHT = 10;

export function drawRotatePrompt(context, iconCanvas) {
  context.fillStyle = OUTLINE_COLOR;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  const stackHeight = iconCanvas.height + ICON_TO_TITLE_GAP + TITLE_HEIGHT + TITLE_TO_BODY_GAP + BODY_HEIGHT;
  const iconY = Math.floor((SCREEN_HEIGHT - stackHeight) / 2);
  context.imageSmoothingEnabled = false;
  context.drawImage(iconCanvas, Math.floor((SCREEN_WIDTH - iconCanvas.width) / 2), iconY);

  const titleY = iconY + iconCanvas.height + ICON_TO_TITLE_GAP;
  drawText(context, 'Turn your phone sideways', SCREEN_WIDTH / 2, titleY, {
    scale: 2,
    align: 'center',
    color: '#feae34',
    outlineColor: OUTLINE_COLOR,
  });
  drawText(context, 'ClaudeJump plays in landscape', SCREEN_WIDTH / 2, titleY + TITLE_HEIGHT + TITLE_TO_BODY_GAP, {
    scale: 1,
    align: 'center',
    color: '#c0cbdc',
    outlineColor: OUTLINE_COLOR,
  });
}
