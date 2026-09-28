import { PhysicsEntity } from '../engine/physics-entity.js';

export const BANANA_WIDTH = 12;
export const BANANA_HEIGHT = 6;
export const BANANA_SLIP_TICKS = 45;

const BANANA_GRAVITY = 0.6;
const BANANA_MAX_FALL_SPEED = 12;
const BANANA_LIFETIME_TICKS = 600;
const BANANA_DROPPER_IMMUNITY_TICKS = 30;

const PEEL_COLOR = '#f0d028';
const TIP_COLOR = '#6a4a20';

// A banana dropped behind a player. It falls until it lands on a platform, then waits for the
// first player to step on it. The dropper cannot slip on it until BANANA_DROPPER_IMMUNITY_TICKS
// have passed. The scene removes it once expired, slipped on, or fallen into the sea.
export class Banana extends PhysicsEntity {
  constructor({ x, y, dropperId }) {
    super({ x, y, width: BANANA_WIDTH, height: BANANA_HEIGHT });
    this.dropperId = dropperId;
    this.ticksRemaining = BANANA_LIFETIME_TICKS;
    this.dropperImmunityTicksRemaining = BANANA_DROPPER_IMMUNITY_TICKS;
    this.expired = false;
  }

  canSlip(player) {
    if (player.inWater) return false;
    return player.id !== this.dropperId || this.dropperImmunityTicksRemaining <= 0;
  }

  update(platforms) {
    this.ticksRemaining--;
    if (this.ticksRemaining <= 0) this.expired = true;
    if (this.dropperImmunityTicksRemaining > 0) this.dropperImmunityTicksRemaining--;
    this.applyGravity(BANANA_GRAVITY, BANANA_MAX_FALL_SPEED);
    this.moveAndCollide(platforms);
  }

  render(context) {
    const drawX = Math.round(this.x);
    const drawY = Math.round(this.y);
    context.fillStyle = PEEL_COLOR;
    context.fillRect(drawX, drawY + 2, this.width, this.height - 2);
    context.fillStyle = TIP_COLOR;
    context.fillRect(drawX, drawY, 2, 2);
    context.fillRect(drawX + this.width - 2, drawY, 2, 2);
  }
}
