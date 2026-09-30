import { BANANA_RAIN_WARNING_TICKS } from '../engine/config.js';
import { Entity } from '../engine/entity.js';
import { BANANA_HEIGHT, BANANA_WIDTH } from './banana.js';

const MARKER_PULSE_TICKS = 8;
const MARKER_COLORS = ['#fee761', '#feae34'];
const MARKER_OUTLINE_COLOR = '#181425';
const MARKER_ARROW_ROWS = 3;
const MARKER_ARROW_GAP = 3;

// The warning for a banana about to fall from above the screen. It flashes on the platform where the banana
// will land. The scene drops the banana once `ticksRemaining` reaches zero.
export class BananaDrop extends Entity {
  constructor({ x, landingY }) {
    super({ x, y: landingY - BANANA_HEIGHT, width: BANANA_WIDTH, height: BANANA_HEIGHT });
    this.ticksRemaining = BANANA_RAIN_WARNING_TICKS;
  }

  update() {
    this.ticksRemaining--;
  }

  render(context) {
    const pulse = Math.floor(this.ticksRemaining / MARKER_PULSE_TICKS) % 2;
    const drawX = Math.round(this.x);
    const drawY = Math.round(this.y);
    context.fillStyle = MARKER_OUTLINE_COLOR;
    context.fillRect(drawX - 1, drawY + this.height, this.width + 2, 3);
    context.fillStyle = MARKER_COLORS[pulse];
    context.fillRect(drawX, drawY + this.height, this.width, 2);
    for (let row = 0; row < MARKER_ARROW_ROWS; row++) {
      const arrowWidth = this.width - 4 * row;
      const arrowY = drawY - MARKER_ARROW_GAP - (MARKER_ARROW_ROWS - row) * 2;
      context.fillStyle = MARKER_COLORS[pulse];
      context.fillRect(drawX + (this.width - arrowWidth) / 2, arrowY, arrowWidth, 2);
    }
  }
}
