import { Entity } from '../engine/entity.js';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { cordFlutter, flutterWobble, swayOffset } from '../vfx/parachute-sway.js';
import { findLandingPlatform, predictCrateLanding } from './crate-landing.js';

export const CRATE_WIDTH = 24;
export const CRATE_HEIGHT = 24;
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
const STRING_COLOR = '#c0cbdc';
// Each arena's canopy has two stripe colors, each with a shade for the canopy's lower edge.
const CANOPY_STRIPES_BY_ARENA = {
  harbor: [
    { color: '#e43b44', shade: '#a22633' },
    { color: '#c0cbdc', shade: '#8b9bb4' },
  ],
  cave: [
    { color: '#feae34', shade: '#d77643' },
    { color: '#733e39', shade: '#3e2731' },
  ],
  rooftops: [
    { color: '#0099db', shade: '#124e89' },
    { color: '#fee761', shade: '#feae34' },
  ],
  'cooling-towers': [
    { color: '#63c74d', shade: '#3e8948' },
    { color: '#c0cbdc', shade: '#8b9bb4' },
  ],
  'server-farm': [
    { color: '#2ce8f5', shade: '#0099db' },
    { color: '#ffffff', shade: '#c0cbdc' },
  ],
  bridge: [
    { color: '#f77622', shade: '#be4a2f' },
    { color: '#fee761', shade: '#feae34' },
  ],
  quarry: [
    { color: '#e43b44', shade: '#a22633' },
    { color: '#feae34', shade: '#d77643' },
  ],
  lighthouse: [
    { color: '#ffffff', shade: '#c0cbdc' },
    { color: '#a22633', shade: '#3e2731' },
  ],
  shipyard: [
    { color: '#feae34', shade: '#d77643' },
    { color: '#5a6988', shade: '#3a4466' },
  ],
  pier: [
    { color: '#0099db', shade: '#124e89' },
    { color: '#ffffff', shade: '#c0cbdc' },
  ],
};
const GOLDEN_CANOPY_STRIPES = [
  { color: '#fee761', shade: '#feae34' },
  { color: '#ffffff', shade: '#c0cbdc' },
];
const CANOPY_STRIPE_WIDTH = 3;
// The crate hangs this many ticks behind the canopy's sway, so it swings under it.
const SWING_LAG_TICKS = 8;
// A landed crate hops this many pixels up over its first ticks on the ground, then rests.
const LANDING_BOUNCE_PIXELS = [0, 2, 3, 3, 2, 1, 0, 1, 0];
const LANDING_DUST_TICKS = 12;
const LANDING_DUST_COLORS = ['#c0cbdc', '#8b9bb4'];
// The golden crate's glint sweeps across it this often, and its sparkles twinkle in turn.
const SHINE_PERIOD_TICKS = 48;
const SHINE_COLOR = '#ffffff';
const SPARKLE_SPOTS = [
  [-3, 3],
  [26, 9],
  [12, -3],
  [-2, 20],
];
const SPARKLE_TICKS = 6;
const CANOPY_WIDTH = 24;
const CANOPY_HEIGHT = 8;
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
// at full speed.
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

  // appearance is { sprites, arenaName }: the loaded sprite files and the arena whose colors the canopy wears.
  render(context, { sprites, arenaName } = {}) {
    const drawX = Math.round(this.x);
    this.renderLandingSpot(context);
    if (!this.landed && !this.dropping && this.ticksUntilLanded >= this.fallTicks) return; // hasn't started falling yet

    const fallenTicks = this.fallTicks - this.ticksUntilLanded;
    const swaying = !this.landed && !this.dropping;
    const distanceToGround = this.markerY - this.y;
    const canopySway = swaying ? swayOffset(fallenTicks, distanceToGround) : 0;
    const crateSway = swaying ? swayOffset(fallenTicks - SWING_LAG_TICKS, distanceToGround) : 0;
    const drawY = Math.round(this.y) - (this.landed ? landingBounce(this.landedTicks) : 0);
    const stripes = canopyStripes(arenaName, this.golden);
    const crateSprite = sprites?.props?.[this.golden ? 'crate-golden' : 'crate'];
    if (!this.parachuteAttached) this.renderFlutteringCanopy(context, stripes);
    const drawAt = (x) => {
      if (this.parachuteAttached && !this.dropping) {
        this.renderParachute(context, { canopyX: x + canopySway, crateX: x + crateSway, crateY: drawY, stripes });
      }
      if (crateSprite) context.drawImage(crateSprite, x + crateSway, drawY);
      if (this.golden) this.renderShine(context, x + crateSway, drawY);
      if (this.landed) this.renderLandingDust(context, x, Math.round(this.y) + this.height);
    };
    drawAt(drawX);
    if (drawX < 0) drawAt(drawX + SCREEN_WIDTH);
    else if (drawX + this.width > SCREEN_WIDTH) drawAt(drawX - SCREEN_WIDTH);
  }

  // A white glint slides diagonally across the golden crate, and sparkles pop around it one at a time.
  renderShine(context, x, y) {
    const tick = this.landed ? this.landedTicks : this.fallTicks - this.ticksUntilLanded;
    const glintStep = tick % SHINE_PERIOD_TICKS;
    context.fillStyle = SHINE_COLOR;
    for (let row = 1; row < this.height - 1; row++) {
      const column = glintStep - row;
      if (column >= 1 && column < this.width - 1) context.fillRect(x + column, y + row, 1, 1);
    }
    const sparkleIndex = Math.floor(tick / SPARKLE_TICKS) % (SPARKLE_SPOTS.length * 2);
    if (sparkleIndex >= SPARKLE_SPOTS.length) return;
    const [sparkleX, sparkleY] = SPARKLE_SPOTS[sparkleIndex];
    context.fillRect(x + sparkleX, y + sparkleY - 1, 1, 3);
    context.fillRect(x + sparkleX - 1, y + sparkleY, 3, 1);
  }

  // Two puffs roll out from under the crate's corners as it lands.
  renderLandingDust(context, x, groundY) {
    if (this.landedTicks >= LANDING_DUST_TICKS) return;
    const spread = 1 + Math.floor(this.landedTicks / 2);
    const size = this.landedTicks < LANDING_DUST_TICKS / 2 ? 3 : 2;
    context.fillStyle = LANDING_DUST_COLORS[this.landedTicks < LANDING_DUST_TICKS / 2 ? 0 : 1];
    const rise = Math.floor(this.landedTicks / 4);
    context.fillRect(x - spread - size + 1, groundY - size - rise, size, size);
    context.fillRect(x + this.width + spread - 1, groundY - size - rise, size, size);
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
  renderFlutteringCanopy(context, stripes) {
    if (this.poppedTicks >= FLUTTER_TICKS) return;
    if (this.poppedTicks > FLUTTER_TICKS - 12 && this.poppedTicks % 2 === 0) return;
    const wobble = flutterWobble(this.poppedTicks);
    const canopyX =
      Math.round(this.poppedAt.x) +
      wobble +
      this.poppedDirectionX * Math.floor(this.poppedTicks / FLUTTER_DRIFT_DIVISOR);
    const canopyY = Math.round(this.poppedAt.y) - Math.floor(this.poppedTicks / FLUTTER_RISE_DIVISOR);
    const flutterHeight = Math.max(2, CANOPY_HEIGHT - Math.floor(this.poppedTicks / 8));
    drawCanopy(context, canopyX, canopyY, CANOPY_WIDTH, flutterHeight, stripes);
  }

  // The striped canopy with two cords that ripple as it falls; on landing the canopy shrinks flat and vanishes.
  renderParachute(context, { canopyX: swayedX, crateX, crateY, stripes }) {
    const foldProgress = this.landedTicks / FOLD_TICKS;
    if (foldProgress >= 1) return;
    const canopyHeight = Math.max(1, Math.round(CANOPY_HEIGHT * (1 - foldProgress)));
    const canopyWidth = Math.max(4, Math.round(CANOPY_WIDTH * (1 - foldProgress * 0.5)));
    const canopyX = swayedX + Math.floor((this.width - canopyWidth) / 2);
    const canopyY = crateY - Math.round(STRING_LENGTH * (1 - foldProgress)) - canopyHeight;
    if (!this.landed) {
      const fallenTicks = this.fallTicks - this.ticksUntilLanded;
      context.fillStyle = STRING_COLOR;
      for (let step = 0; step < STRING_LENGTH; step++) {
        // Each cord runs from the canopy's edge to the crate's corner, rippling as the canopy sways.
        const share = (step + 1) / STRING_LENGTH;
        const flutter = cordFlutter(fallenTicks, step);
        const leftX = Math.round(canopyX + 1 + (crateX + 1 - canopyX - 1) * share) + flutter;
        const rightX = Math.round(canopyX + canopyWidth - 2 + (crateX - canopyX) * share) - flutter;
        context.fillRect(leftX, canopyY + canopyHeight + step, 1, 1);
        context.fillRect(rightX, canopyY + canopyHeight + step, 1, 1);
      }
    }
    drawCanopy(context, canopyX, canopyY, canopyWidth, canopyHeight, stripes);
  }
}

// The two stripe colors a crate's canopy wears in an arena. The golden crate always wears gold and white.
export function canopyStripes(arenaName, golden = false) {
  if (golden) return GOLDEN_CANOPY_STRIPES;
  return CANOPY_STRIPES_BY_ARENA[arenaName] ?? CANOPY_STRIPES_BY_ARENA.harbor;
}

// How many pixels a crate that landed `landedTicks` ago is drawn above where it rests.
export function landingBounce(landedTicks) {
  return LANDING_BOUNCE_PIXELS[landedTicks] ?? 0;
}

// A dome: the top two rows step in so the canopy reads as round, not as a bar. Stripes run top to bottom and are shaded
// along the canopy's lower edge.
function drawCanopy(context, x, y, width, height, stripes) {
  for (let row = 0; row < height; row++) {
    const inset = height >= 3 ? Math.max(0, 2 - row) * 2 : 0;
    const rowWidth = width - inset * 2;
    context.fillStyle = OUTLINE_COLOR;
    context.fillRect(x + inset, y + row, rowWidth, 1);
    if (row === 0 || row === height - 1 || rowWidth < 3) continue;
    for (let column = inset + 1; column < inset + rowWidth - 1; column++) {
      const stripe = stripes[Math.floor(column / CANOPY_STRIPE_WIDTH) % stripes.length];
      context.fillStyle = row === height - 2 ? stripe.shade : stripe.color;
      context.fillRect(x + column, y + row, 1, 1);
    }
  }
}
