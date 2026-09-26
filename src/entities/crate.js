import { Entity } from '../engine/entity.js';

export const CRATE_WIDTH = 8;
export const CRATE_HEIGHT = 8;
// How long the warning marker flashes at the landing spot before the crate drops.
export const CRATE_WARNING_TICKS = 60;

const MARKER_FLASH_TICKS = 10;
const MARKER_COLOR = '#ffdc28';
const CRATE_SHADOW_COLOR = '#5c3c1e';
const CRATE_FILL_COLOR = '#a0703c';

// A crate holding one card. It shows a warning marker at its landing spot, then drops and can
// be taken by any player without a held card. Placeholder shapes only; see #20 for real art.
export class Crate extends Entity {
  constructor({ x, y, cardName }) {
    super({ x, y, width: CRATE_WIDTH, height: CRATE_HEIGHT });
    this.cardName = cardName;
    this.ticksUntilLanded = CRATE_WARNING_TICKS;
    this.landed = false;
  }

  update() {
    if (this.landed) return;
    this.ticksUntilLanded--;
    if (this.ticksUntilLanded <= 0) this.landed = true;
  }

  render(context) {
    const drawX = Math.round(this.x);
    const drawY = Math.round(this.y);
    if (!this.landed) {
      if (Math.floor(this.ticksUntilLanded / MARKER_FLASH_TICKS) % 2 !== 0) return;
      context.fillStyle = MARKER_COLOR;
      context.fillRect(drawX, drawY, this.width, this.height);
      return;
    }

    context.fillStyle = CRATE_SHADOW_COLOR;
    context.fillRect(drawX, drawY, this.width, this.height);
    context.fillStyle = CRATE_FILL_COLOR;
    context.fillRect(drawX + 1, drawY + 1, this.width - 2, this.height - 2);
  }
}
