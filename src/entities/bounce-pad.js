import { Entity } from '../engine/entity.js';

export const BOUNCE_PAD_WIDTH = 24;
export const BOUNCE_PAD_HEIGHT = 6;
export const BOUNCE_PAD_LIFETIME_TICKS = 300; // 5 seconds
export const BOUNCE_PAD_LAUNCH_VELOCITY = -12.5; // stronger than a full jump's -10.4
export const BOUNCE_PAD_FLING_VELOCITY_X = 12.3;
export const BOUNCE_PAD_FLING_VELOCITY_Y = -4;

const PAD_COLOR = '#3898c8';
const PAD_HIGHLIGHT_COLOR = '#78d8f0';

// With no owner it is a neutral jump pad for everyone. With an owner it is a trap that flings the
// other players and breaks. A trap disappears after BOUNCE_PAD_LIFETIME_TICKS. A level's fixed pads
// pass a lifetime of Infinity so they never do.
// Placeholder shape only.
export class BouncePad extends Entity {
  constructor({ x, y, lifetimeTicks = BOUNCE_PAD_LIFETIME_TICKS, ownerId = null }) {
    super({ x, y, width: BOUNCE_PAD_WIDTH, height: BOUNCE_PAD_HEIGHT });
    this.ownerId = ownerId;
    this.ticksRemaining = lifetimeTicks;
    this.expired = false;
  }

  update() {
    this.ticksRemaining--;
    if (this.ticksRemaining <= 0) this.expired = true;
  }

  // Only a fall that crosses the pad's top surface this tick counts as landing on it.
  // Walking into its side never crosses that surface, so it does nothing.
  isLandedOnBy(player) {
    if (player.velocityY <= 0) return false;
    const previousFeetY = player.previousY + player.height;
    const feetY = player.y + player.height;
    if (previousFeetY > this.y || feetY <= this.y) return false;
    return player.x + player.width > this.x && player.x < this.x + this.width;
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
