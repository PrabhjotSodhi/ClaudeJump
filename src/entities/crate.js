import { Entity } from '../engine/entity.js';

export const CRATE_WIDTH = 16;
export const CRATE_HEIGHT = 16;
// How long the marker shows at the landing spot before the crate lands there, warning included.
export const CRATE_WARNING_TICKS = 60;

const MARKER_FLASH_TICKS = 10;
const MARKER_COLOR = '#fee761';
const CRATE_SHADOW_COLOR = '#5c3c1e';
const CRATE_FILL_COLOR = '#a0703c';
// How many pixels the crate falls each tick. The sway is a render offset only, so it never
// changes how long the fall takes or where the crate lands.
const FALL_SPEED = 4;
const OUTLINE_COLOR = '#3e2731';
const CANOPY_COLOR = '#f77622';
const CANOPY_LIGHT_COLOR = '#feae34';
const CANOPY_SHADE_COLOR = '#be4a2f';
const STRING_COLOR = '#c0cbdc';
const CANOPY_WIDTH = 16;
const CANOPY_HEIGHT = 7;
const STRING_LENGTH = 6;
const SWAY_MAX_PIXELS = 6;
const SWAY_PERIOD_TICKS = 70;
// The sway shrinks with the distance left to fall, so it is gone by the time the crate lands.
const SWAY_SETTLE_DISTANCE = 120;
const FOLD_TICKS = 12;
// Comfortably above the top of the screen so the crate is never visible before it starts falling.
const FALL_START_Y = -CRATE_HEIGHT;

// Sideways offset in pixels for a crate that has fallen for `fallenTicks` ticks and has
// `distanceToGround` pixels left. A pure function of its inputs.
export function swayOffset(fallenTicks, distanceToGround) {
  const amplitude = SWAY_MAX_PIXELS * Math.min(1, Math.max(0, distanceToGround) / SWAY_SETTLE_DISTANCE);
  return Math.round(Math.sin((fallenTicks * 2 * Math.PI) / SWAY_PERIOD_TICKS) * amplitude) + 0;
}

// A crate holding one card. Its marker flashes at the spot it is aimed at, then it drops in from
// above the screen and stops on whichever platform it reaches first, or falls into the sea if
// none is below it. It can be taken by any player without a held card, in the air or landed.
// It hangs under a parachute that sways
// while it falls and folds away on landing. Placeholder shapes for the crate itself.
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
    this.landedTicks = 0;
  }

  // False while the crate is still just a marker, waiting above the screen out of anyone's reach.
  get isFalling() {
    return this.landed || this.ticksUntilLanded < this.fallTicks;
  }

  update(platforms = []) {
    if (this.landed) {
      this.landedTicks++;
      return;
    }
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

    const fallenTicks = this.fallTicks - this.ticksUntilLanded;
    const sway = this.landed ? 0 : swayOffset(fallenTicks, this.markerY - this.y);
    const drawY = Math.round(this.y);
    this.renderParachute(context, drawX + sway, drawY);
    context.fillStyle = CRATE_SHADOW_COLOR;
    context.fillRect(drawX + sway, drawY, this.width, this.height);
    context.fillStyle = CRATE_FILL_COLOR;
    context.fillRect(drawX + sway + 2, drawY + 2, this.width - 4, this.height - 4);
  }

  // Open canopy with two strings while falling; on landing the canopy shrinks flat and vanishes.
  renderParachute(context, crateX, crateY) {
    const foldProgress = this.landedTicks / FOLD_TICKS;
    if (foldProgress >= 1) return;
    const canopyHeight = Math.max(1, Math.round(CANOPY_HEIGHT * (1 - foldProgress)));
    const canopyWidth = Math.max(4, Math.round(CANOPY_WIDTH * (1 - foldProgress * 0.5)));
    const canopyX = crateX + Math.floor((this.width - canopyWidth) / 2);
    const canopyY = crateY - Math.round(STRING_LENGTH * (1 - foldProgress)) - canopyHeight;
    if (!this.landed) {
      context.fillStyle = STRING_COLOR;
      for (let step = 0; step < STRING_LENGTH; step++) {
        const inset = Math.floor((step * 3) / STRING_LENGTH);
        context.fillRect(canopyX + 1 + inset, canopyY + canopyHeight + step, 1, 1);
        context.fillRect(canopyX + canopyWidth - 2 - inset, canopyY + canopyHeight + step, 1, 1);
      }
    }
    context.fillStyle = OUTLINE_COLOR;
    context.fillRect(canopyX, canopyY, canopyWidth, canopyHeight);
    if (canopyHeight < 3 || canopyWidth < 6) return;
    context.fillStyle = CANOPY_COLOR;
    context.fillRect(canopyX + 1, canopyY + 1, canopyWidth - 2, canopyHeight - 2);
    context.fillStyle = CANOPY_LIGHT_COLOR;
    context.fillRect(canopyX + 1, canopyY + 1, canopyWidth - 2, 1);
    context.fillStyle = CANOPY_SHADE_COLOR;
    context.fillRect(canopyX + 1, canopyY + canopyHeight - 2, canopyWidth - 2, 1);
  }
}
