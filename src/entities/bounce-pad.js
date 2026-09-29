import { Entity } from '../engine/entity.js';

export const BOUNCE_PAD_WIDTH = 24;
export const BOUNCE_PAD_HEIGHT = 6;
export const BOUNCE_PAD_LIFETIME_TICKS = 300; // 5 seconds
export const BOUNCE_PAD_LAUNCH_VELOCITY = -15; // stronger than a full jump's -10.4

const PAD_COLOR = '#3898c8';
const PAD_HIGHLIGHT_COLOR = '#78d8f0';

// A launch pad. One dropped at a player's feet disappears after BOUNCE_PAD_LIFETIME_TICKS. A level's
// fixed pads pass a lifetime of Infinity so they never do.
// Placeholder shape only.
export class BouncePad extends Entity {
  constructor({ x, y, lifetimeTicks = BOUNCE_PAD_LIFETIME_TICKS }) {
    super({ x, y, width: BOUNCE_PAD_WIDTH, height: BOUNCE_PAD_HEIGHT });
    this.ticksRemaining = lifetimeTicks;
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
    context.fillRect(drawX + 2, drawY, this.width - 4, 2);
  }
}
