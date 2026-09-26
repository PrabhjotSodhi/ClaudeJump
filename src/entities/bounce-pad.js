import { Entity } from '../engine/entity.js';

export const BOUNCE_PAD_WIDTH = 12;
export const BOUNCE_PAD_HEIGHT = 3;
export const BOUNCE_PAD_LIFETIME_TICKS = 300; // 5 seconds
export const BOUNCE_PAD_LAUNCH_VELOCITY = -7.5; // stronger than a full jump's -5.2

const PAD_COLOR = '#3898c8';
const PAD_HIGHLIGHT_COLOR = '#78d8f0';

// A temporary launch pad dropped at a player's feet. It disappears after BOUNCE_PAD_LIFETIME_TICKS.
// Placeholder shape only.
export class BouncePad extends Entity {
  constructor({ x, y }) {
    super({ x, y, width: BOUNCE_PAD_WIDTH, height: BOUNCE_PAD_HEIGHT });
    this.ticksRemaining = BOUNCE_PAD_LIFETIME_TICKS;
    this.expired = false;
  }

  update() {
    this.ticksRemaining--;
    if (this.ticksRemaining <= 0) this.expired = true;
  }

  render(context) {
    const drawX = Math.round(this.x);
    const drawY = Math.round(this.y);
    context.fillStyle = PAD_COLOR;
    context.fillRect(drawX, drawY, this.width, this.height);
    context.fillStyle = PAD_HIGHLIGHT_COLOR;
    context.fillRect(drawX + 1, drawY, this.width - 2, 1);
  }
}
