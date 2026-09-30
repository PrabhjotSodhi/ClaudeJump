import { Entity } from '../engine/entity.js';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { swayOffset } from '../vfx/parachute-sway.js';
import { findLandingPlatform, predictCrateLanding } from './crate-landing.js';

export const CRATE_WIDTH = 16;
export const CRATE_HEIGHT = 16;
// How long the marker shows at the landing spot before the crate lands there, warning included.
export const CRATE_WARNING_TICKS = 60;

const MARKER_FLASH_TICKS = 10;
const MARKER_COLOR = '#fee761';
const MARKER_CORNER_WIDTH = 3;
const MARKER_HEIGHT = 2;
const GROUND_SHADOW_COLOR = '#3e2731';
const GROUND_SHADOW_MIN_WIDTH = 4;
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
const FOLD_TICKS = 12;
// Comfortably above the top of the screen so the crate is never visible before it starts falling.
const FALL_START_Y = -CRATE_HEIGHT;

// A crate holding one card. Its marker flashes on the surface it will land on, then it drops in from
// above the screen and stops on whichever platform it reaches first, or falls into the sea if
// none is below it. `landing` holds the predicted spot, refreshed every tick because blocks can
// break under it, and a shadow on that spot grows as the crate comes down. It can be taken by any player without a held card, in the air or landed.
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
    this.landing = null;
  }

  // Refreshes `landing`: the spot { x, y, ticks } where this crate will rest, or null over the sea.
  predictLanding(platforms) {
    this.landing = predictCrateLanding({
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      fallSpeed: FALL_SPEED,
      platforms,
      fallLimitY: SCREEN_HEIGHT,
    });
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
    this.predictLanding(platforms);
    this.ticksUntilLanded--;
    if (this.ticksUntilLanded >= this.fallTicks) return; // still just a marker, hasn't appeared yet

    this.y += FALL_SPEED;
    const platform = findLandingPlatform({ x: this.x, width: this.width, bottom: this.y + this.height, platforms });
    if (!platform) return;
    this.y = platform.y - this.height;
    this.landed = true;
  }

  render(context) {
    const drawX = Math.round(this.x);
    this.renderLandingSpot(context);
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

  // The marker and the growing shadow sit on the surface the crate will land on, drawn again on the
  // far side when the crate straddles a screen edge.
  renderLandingSpot(context) {
    if (this.landed || !this.landing) return;
    const spotX = Math.round(this.landing.x);
    const surfaceY = Math.round(this.landing.y) + this.height;
    const fallProgress = this.isFalling
      ? Math.min(1, Math.max(0, (this.y - FALL_START_Y) / (this.landing.y - FALL_START_Y)))
      : 0;
    const shadowWidth = GROUND_SHADOW_MIN_WIDTH + Math.round((this.width - GROUND_SHADOW_MIN_WIDTH) * fallProgress);
    const markerVisible = Math.floor(this.ticksUntilLanded / MARKER_FLASH_TICKS) % 2 === 0;
    const drawAt = (x) => {
      if (this.isFalling) {
        context.fillStyle = GROUND_SHADOW_COLOR;
        context.fillRect(
          x + Math.floor((this.width - shadowWidth) / 2),
          surfaceY - MARKER_HEIGHT,
          shadowWidth,
          MARKER_HEIGHT,
        );
      }
      if (!markerVisible) return;
      context.fillStyle = MARKER_COLOR;
      context.fillRect(x, surfaceY - MARKER_HEIGHT, MARKER_CORNER_WIDTH, MARKER_HEIGHT);
      context.fillRect(
        x + this.width - MARKER_CORNER_WIDTH,
        surfaceY - MARKER_HEIGHT,
        MARKER_CORNER_WIDTH,
        MARKER_HEIGHT,
      );
    };
    drawAt(spotX);
    if (spotX < 0) drawAt(spotX + SCREEN_WIDTH);
    else if (spotX + this.width > SCREEN_WIDTH) drawAt(spotX - SCREEN_WIDTH);
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
    // A dome: the top two rows step in so the canopy reads as round, not as a bar.
    for (let row = 0; row < canopyHeight; row++) {
      const inset = canopyHeight >= 3 ? Math.max(0, 2 - row) * 2 : 0;
      const rowWidth = canopyWidth - inset * 2;
      context.fillStyle = OUTLINE_COLOR;
      context.fillRect(canopyX + inset, canopyY + row, rowWidth, 1);
      if (row === 0 || row === canopyHeight - 1 || rowWidth < 3) continue;
      context.fillStyle = row === 1 ? CANOPY_LIGHT_COLOR : row === canopyHeight - 2 ? CANOPY_SHADE_COLOR : CANOPY_COLOR;
      context.fillRect(canopyX + inset + 1, canopyY + row, rowWidth - 2, 1);
    }
  }
}
