import { Entity } from '../engine/entity.js';

export const CRATE_WIDTH = 8;
export const CRATE_HEIGHT = 8;
// How long the marker shows at the landing spot before the crate lands there, warning included.
export const CRATE_WARNING_TICKS = 60;

const MARKER_FLASH_TICKS = 10;
const MARKER_COLOR = '#ffdc28';
const CRATE_SHADOW_COLOR = '#5c3c1e';
const CRATE_FILL_COLOR = '#a0703c';
// How many pixels the crate falls each tick. Kept steady so a later sway can be layered on top
// without changing how long the fall takes.
const FALL_SPEED = 2;
// Comfortably above the top of the screen so the crate is never visible before it starts falling.
const FALL_START_Y = -CRATE_HEIGHT;

// A crate holding one card. Its marker flashes at the spot it is aimed at, then it drops in from
// above the screen and stops on whichever platform it reaches first, or falls into the sea if
// none is below it. It can be taken by any player without a held card, in the air or landed.
// Placeholder shapes only.
export class Crate extends Entity {
  constructor({ x, y, cardName }) {
    super({ x, y: FALL_START_Y, width: CRATE_WIDTH, height: CRATE_HEIGHT });
    this.markerY = y;
    this.cardName = cardName;
    this.ticksUntilLanded = CRATE_WARNING_TICKS;
    // Falling this many ticks at FALL_SPEED covers the distance to the marked spot, so starting
    // the fall this many ticks before the deadline lands the crate right on schedule.
    this.fallTicks = Math.min(CRATE_WARNING_TICKS, Math.ceil((this.markerY - FALL_START_Y) / FALL_SPEED));
    this.landed = false;
  }

  // False while the crate is still just a marker, waiting above the screen out of anyone's reach.
  get isFalling() {
    return this.landed || this.ticksUntilLanded < this.fallTicks;
  }

  update(platforms = []) {
    if (this.landed) return;
    this.ticksUntilLanded--;
    if (this.ticksUntilLanded >= this.fallTicks) return; // still just a marker, hasn't appeared yet

    this.y += FALL_SPEED;
    for (const platform of platforms) {
      if (this.x + this.width <= platform.x || this.x >= platform.x + platform.width) continue;
      if (this.y + this.height < platform.y) continue;
      this.y = platform.y - this.height;
      this.landed = true;
      break;
    }
  }

  render(context) {
    const drawX = Math.round(this.x);
    if (!this.landed && Math.floor(this.ticksUntilLanded / MARKER_FLASH_TICKS) % 2 === 0) {
      context.fillStyle = MARKER_COLOR;
      context.fillRect(drawX, Math.round(this.markerY), this.width, this.height);
    }
    if (!this.landed && this.ticksUntilLanded >= this.fallTicks) return; // hasn't started falling yet

    const drawY = Math.round(this.y);
    context.fillStyle = CRATE_SHADOW_COLOR;
    context.fillRect(drawX, drawY, this.width, this.height);
    context.fillStyle = CRATE_FILL_COLOR;
    context.fillRect(drawX + 1, drawY + 1, this.width - 2, this.height - 2);
  }
}
