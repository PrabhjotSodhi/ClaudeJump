import { PhysicsEntity } from '../engine/physics-entity.js';

export const BANANA_WIDTH = 12;
export const BANANA_HEIGHT = 6;
export const BANANA_SLIP_TICKS = 45;
// A played banana is tossed backward over the thrower's shoulder in a short arc.
export const BANANA_THROW_SPEED_X = 2.5;
export const BANANA_THROW_SPEED_Y = -4;

const BANANA_GRAVITY = 0.6;
const BANANA_MAX_FALL_SPEED = 12;
const BANANA_LIFETIME_TICKS = 600;
const BANANA_DROPPER_IMMUNITY_TICKS = 30;
// The sprites in data/sprites/props.json are bottom centered on the hitbox. In the air the peel tumbles through its
// frames, one every BANANA_SPIN_TICKS.
const AIR_FRAMES = ['banana-air-0', 'banana-air-1', 'banana-air-2', 'banana-air-3'];
const BANANA_SPIN_TICKS = 3;

// A banana peel thrown behind a player, or dropped from above by banana rain. It flies until it lands on a platform,
// then lies flat and waits for the first player to step on it. The dropper cannot slip on it until
// BANANA_DROPPER_IMMUNITY_TICKS have passed. The scene removes it once expired, slipped on, or fallen into the sea.
export class Banana extends PhysicsEntity {
  constructor({ x, y, dropperId, velocityX = 0, velocityY = 0 }) {
    super({ x, y, width: BANANA_WIDTH, height: BANANA_HEIGHT });
    this.dropperId = dropperId;
    this.velocityX = velocityX;
    this.velocityY = velocityY;
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
    if (this.onGround) this.velocityX = 0;
  }

  render(context, { sprites } = {}) {
    const age = BANANA_LIFETIME_TICKS - this.ticksRemaining;
    const frameName = this.onGround
      ? 'banana-peel'
      : AIR_FRAMES[Math.floor(age / BANANA_SPIN_TICKS) % AIR_FRAMES.length];
    const sprite = sprites?.props?.[frameName];
    if (!sprite) return;
    const drawX = Math.round(this.x + this.width / 2 - sprite.width / 2);
    const drawY = Math.round(this.y + this.height - sprite.height);
    context.drawImage(sprite, drawX, drawY);
  }
}
