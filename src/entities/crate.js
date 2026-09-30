import { Entity } from '../engine/entity.js';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { flutterWobble, swayOffset } from '../vfx/parachute-sway.js';
import { findLandingPlatform, predictCrateLanding } from './crate-landing.js';

export const CRATE_WIDTH = 16;
export const CRATE_HEIGHT = 16;
// How long the marker shows at the landing spot before the crate lands there, warning included.
export const CRATE_WARNING_TICKS = 60;

const MARKER_PULSE_TICKS = 8;
const MARKER_COLORS = ['#fee761', '#feae34'];
const GOLDEN_MARKER_COLORS = ['#fee761', '#ffffff'];
const MARKER_OUTLINE_COLOR = '#181425';
const MARKER_BRACKET_WIDTH = 3;
const MARKER_BRACKET_HEIGHT = 6;
const MARKER_ARROW_GAP = 3;
const MARKER_ARROW_WIDTH = 8;
const MARKER_ARROW_ROW_HEIGHT = 2;
const MARKER_ARROW_BOB_PIXELS = 4;
const SHADOW_HEIGHT = 2;
const GROUND_SHADOW_COLOR = '#3e2731';
const GROUND_SHADOW_MIN_WIDTH = 4;
const CRATE_SHADOW_COLOR = '#5c3c1e';
const CRATE_FILL_COLOR = '#a0703c';
const GOLDEN_SHADOW_COLOR = '#feae34';
const GOLDEN_FILL_COLOR = '#fee761';
// How many pixels the crate falls each tick. The sway is a render offset only, so it never
// changes how long the fall takes or where the crate lands.
const FALL_SPEED = 4;
// A landed crate pushed sideways slides at these speeds and loses SLIDE_FRICTION of speed each tick.
export const SHOVE_SLIDE_SPEED = 6;
export const CHARGED_SHOVE_SLIDE_SPEED = 10;
export const BLAST_SLIDE_SPEED = 10;
const SLIDE_FRICTION = 0.4;
// A crate that slides off the edge of its platform drops at this speed.
const DROP_SPEED = 8;
// Without its parachute the crate drops twice as fast.
const POPPED_FALL_SPEED = 8;
const OUTLINE_COLOR = '#3e2731';
const CANOPY_COLOR = '#f77622';
const CANOPY_LIGHT_COLOR = '#feae34';
const CANOPY_SHADE_COLOR = '#be4a2f';
const STRING_COLOR = '#c0cbdc';
const CANOPY_WIDTH = 16;
const CANOPY_HEIGHT = 7;
const STRING_LENGTH = 6;
const FOLD_TICKS = 12;
// A popped canopy drifts up and to the side for this long, then is gone.
const FLUTTER_TICKS = 40;
const FLUTTER_RISE_DIVISOR = 3;
const FLUTTER_DRIFT_DIVISOR = 2;
// Comfortably above the top of the screen so the crate is never visible before it starts falling.
const FALL_START_Y = -CRATE_HEIGHT;

// A crate holding one card. Its marker flashes on the surface it will land on, then it drops in from
// above the screen and stops on whichever platform it reaches first, or falls into the sea if
// none is below it. `landing` holds the predicted spot, refreshed every tick because blocks can
// break under it, and a shadow on that spot grows as the crate comes down. It can be taken by any player without a held card, in the air or landed.
// It hangs under a parachute that sways
// while it falls and folds away on landing. A hit on the parachute pops it and the crate then falls
// at full speed. Placeholder shapes for the crate itself.
export class Crate extends Entity {
  constructor({ x, y, cardName, golden = false }) {
    super({ x, y: FALL_START_Y, width: CRATE_WIDTH, height: CRATE_HEIGHT });
    this.markerY = y;
    this.cardName = cardName;
    this.golden = golden;
    this.ticksUntilLanded = CRATE_WARNING_TICKS;
    // Falling this many ticks at FALL_SPEED covers the distance to the marked spot, so starting
    // the fall this many ticks before the deadline lands the crate right on schedule.
    this.fallTicks = Math.min(CRATE_WARNING_TICKS, Math.ceil((this.markerY - FALL_START_Y) / FALL_SPEED));
    this.landed = false;
    this.landedTicks = 0;
    this.landing = null;
    this.slideVelocityX = 0;
    this.dropping = false;
    this.parachuteAttached = true;
    this.poppedTicks = 0;
    this.poppedDirectionX = 1;
    this.poppedAt = null;
  }

  // Pushes a landed crate sideways. Returns false when the crate is still in the air.
  slide(velocityX) {
    if (!this.landed) return false;
    this.slideVelocityX = velocityX;
    return true;
  }

  get fallSpeed() {
    return this.parachuteAttached ? FALL_SPEED : POPPED_FALL_SPEED;
  }

  // The canopy and its strings, where a shove, rocket, bomb or blast can pop the parachute. Null when there is
  // nothing to pop: the crate has not appeared yet, has landed, or already lost its parachute.
  get parachuteBounds() {
    if (!this.parachuteAttached || this.landed || !this.isFalling) return null;
    const height = CANOPY_HEIGHT + STRING_LENGTH;
    return { x: this.x + (this.width - CANOPY_WIDTH) / 2, y: this.y - height, width: CANOPY_WIDTH, height };
  }

  // Returns true when this pops the parachute. `directionX` is the way the canopy flutters off, and
  // `platforms` lets the landing marker move to where the faster fall ends.
  popParachute(directionX, platforms) {
    const bounds = this.parachuteBounds;
    if (!bounds) return false;
    this.parachuteAttached = false;
    this.poppedDirectionX = directionX < 0 ? -1 : 1;
    this.poppedAt = { x: bounds.x, y: bounds.y };
    this.predictLanding(platforms);
    return true;
  }

  // Refreshes `landing`: the spot { x, y, ticks } where this crate will rest, or null over the sea.
  predictLanding(platforms) {
    this.landing = predictCrateLanding({
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      fallSpeed: this.fallSpeed,
      platforms,
      fallLimitY: SCREEN_HEIGHT,
    });
  }

  // False while the crate is still just a marker, waiting above the screen out of anyone's reach.
  get isFalling() {
    return this.landed || this.ticksUntilLanded < this.fallTicks;
  }

  update(platforms = []) {
    if (!this.parachuteAttached) this.poppedTicks++;
    if (this.dropping) {
      this.drop(platforms);
      return;
    }
    if (this.landed) {
      this.landedTicks++;
      this.slideAlongPlatform(platforms);
      return;
    }
    this.predictLanding(platforms);
    this.ticksUntilLanded--;
    if (this.ticksUntilLanded >= this.fallTicks) return; // still just a marker, hasn't appeared yet

    this.y += this.fallSpeed;
    const platform = findLandingPlatform({ x: this.x, width: this.width, bottom: this.y + this.height, platforms });
    if (!platform) return;
    this.y = platform.y - this.height;
    this.landed = true;
  }

  moveSideways() {
    this.x += this.slideVelocityX;
    const speed = Math.max(0, Math.abs(this.slideVelocityX) - SLIDE_FRICTION);
    this.slideVelocityX = Math.sign(this.slideVelocityX) * speed;
  }

  // A landed crate slides and comes to a stop with friction. With no platform left under it, it drops.
  slideAlongPlatform(platforms) {
    if (this.slideVelocityX === 0) return;
    this.moveSideways();
    const restingPlatforms = platforms.filter((platform) => platform.y === this.y + this.height);
    if (
      findLandingPlatform({ x: this.x, width: this.width, bottom: this.y + this.height, platforms: restingPlatforms })
    ) {
      return;
    }
    this.landed = false;
    this.dropping = true;
    this.landing = null;
  }

  // Falls straight down, keeping any sideways slide, and lands on the first platform it passes through.
  drop(platforms) {
    const previousBottom = this.y + this.height;
    this.moveSideways();
    this.y += DROP_SPEED;
    const platform = findLandingPlatform({
      x: this.x,
      width: this.width,
      bottom: this.y + this.height,
      platforms: platforms.filter((candidate) => candidate.y >= previousBottom),
    });
    if (!platform) return;
    this.y = platform.y - this.height;
    this.dropping = false;
    this.landed = true;
  }

  render(context) {
    const drawX = Math.round(this.x);
    this.renderLandingSpot(context);
    if (!this.landed && !this.dropping && this.ticksUntilLanded >= this.fallTicks) return; // hasn't started falling yet

    const fallenTicks = this.fallTicks - this.ticksUntilLanded;
    const sway = this.landed || this.dropping ? 0 : swayOffset(fallenTicks, this.markerY - this.y);
    const drawY = Math.round(this.y);
    if (!this.parachuteAttached) this.renderFlutteringCanopy(context);
    const drawAt = (x) => {
      if (this.parachuteAttached && !this.dropping) this.renderParachute(context, x + sway, drawY);
      context.fillStyle = this.golden ? GOLDEN_SHADOW_COLOR : CRATE_SHADOW_COLOR;
      context.fillRect(x + sway, drawY, this.width, this.height);
      context.fillStyle = this.golden ? GOLDEN_FILL_COLOR : CRATE_FILL_COLOR;
      context.fillRect(x + sway + 2, drawY + 2, this.width - 4, this.height - 4);
    };
    drawAt(drawX);
    if (drawX < 0) drawAt(drawX + SCREEN_WIDTH);
    else if (drawX + this.width > SCREEN_WIDTH) drawAt(drawX - SCREEN_WIDTH);
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
    const pulse = Math.floor(this.ticksUntilLanded / MARKER_PULSE_TICKS);
    const markerColors = this.golden ? GOLDEN_MARKER_COLORS : MARKER_COLORS;
    const markerColor = markerColors[pulse % markerColors.length];
    const arrowBob = pulse % 2 === 0 ? 0 : MARKER_ARROW_BOB_PIXELS;
    const drawAt = (x) => {
      if (this.isFalling) {
        context.fillStyle = GROUND_SHADOW_COLOR;
        context.fillRect(
          x + Math.floor((this.width - shadowWidth) / 2),
          surfaceY - SHADOW_HEIGHT,
          shadowWidth,
          SHADOW_HEIGHT,
        );
      }
      const leftX = x - MARKER_BRACKET_WIDTH;
      const rightX = x + this.width;
      const bracketY = surfaceY - MARKER_BRACKET_HEIGHT;
      context.fillStyle = MARKER_OUTLINE_COLOR;
      for (const bracketX of [leftX, rightX]) {
        context.fillRect(bracketX - 1, bracketY - 1, MARKER_BRACKET_WIDTH + 2, MARKER_BRACKET_HEIGHT + 2);
      }
      context.fillStyle = markerColor;
      for (const bracketX of [leftX, rightX]) {
        context.fillRect(bracketX, bracketY, MARKER_BRACKET_WIDTH, MARKER_BRACKET_HEIGHT);
      }
      // A down arrow above the surface that narrows by one pixel each side per row.
      const arrowRows = MARKER_ARROW_WIDTH / 2;
      const arrowHeight = arrowRows * MARKER_ARROW_ROW_HEIGHT;
      const arrowCenterX = x + Math.floor(this.width / 2);
      const arrowTopY = bracketY - MARKER_ARROW_GAP - arrowHeight - arrowBob;
      const drawArrowRows = (color, outlineWidth) => {
        context.fillStyle = color;
        for (let row = 0; row < arrowRows; row++) {
          const halfWidth = arrowRows - row + outlineWidth;
          context.fillRect(
            arrowCenterX - halfWidth,
            arrowTopY + row * MARKER_ARROW_ROW_HEIGHT,
            halfWidth * 2,
            MARKER_ARROW_ROW_HEIGHT,
          );
        }
      };
      drawArrowRows(MARKER_OUTLINE_COLOR, 1);
      context.fillRect(arrowCenterX - arrowRows - 1, arrowTopY - 1, arrowRows * 2 + 2, 1);
      context.fillRect(arrowCenterX - 1, arrowTopY + arrowHeight, 2, 1);
      drawArrowRows(markerColor, 0);
    };
    drawAt(spotX);
    if (spotX < 0) drawAt(spotX + SCREEN_WIDTH);
    else if (spotX + this.width > SCREEN_WIDTH) drawAt(spotX - SCREEN_WIDTH);
  }

  // The popped canopy stays where it was hit, drifting up and away, and blinks out as it ends.
  renderFlutteringCanopy(context) {
    if (this.poppedTicks >= FLUTTER_TICKS) return;
    if (this.poppedTicks > FLUTTER_TICKS - 12 && this.poppedTicks % 2 === 0) return;
    const wobble = flutterWobble(this.poppedTicks);
    const canopyX =
      Math.round(this.poppedAt.x) +
      wobble +
      this.poppedDirectionX * Math.floor(this.poppedTicks / FLUTTER_DRIFT_DIVISOR);
    const canopyY = Math.round(this.poppedAt.y) - Math.floor(this.poppedTicks / FLUTTER_RISE_DIVISOR);
    const flutterHeight = Math.max(2, CANOPY_HEIGHT - Math.floor(this.poppedTicks / 8));
    context.fillStyle = OUTLINE_COLOR;
    context.fillRect(canopyX, canopyY, CANOPY_WIDTH, flutterHeight);
    context.fillStyle = CANOPY_COLOR;
    context.fillRect(canopyX + 1, canopyY + 1, CANOPY_WIDTH - 2, Math.max(0, flutterHeight - 2));
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
