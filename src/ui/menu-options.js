import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';

const BACKDROP_COLOR = 'rgba(20, 20, 40, 0.7)';

export function drawMenuBackdrop(context) {
  context.fillStyle = BACKDROP_COLOR;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
}
