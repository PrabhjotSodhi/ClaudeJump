import { SCREEN_WIDTH } from './config.js';
import { Entity } from './entity.js';

// Airborne knockback fades slowly (a hit sends a player flying), grounded knockback fades fast (it just shoves them).
const AIR_KNOCKBACK_DECAY = 0.5;
const GROUND_KNOCKBACK_DECAY = 1;

export class PhysicsEntity extends Entity {
  constructor({ x, y, width, height }) {
    super({ x, y, width, height });
    this.velocityX = 0;
    this.velocityY = 0;
    this.knockbackVelocityX = 0;
    this.onGround = false;
    this.previousY = y;
  }

  get knockbackDecay() {
    return this.onGround ? GROUND_KNOCKBACK_DECAY : AIR_KNOCKBACK_DECAY;
  }

  applyGravity(gravity, maxFallSpeed) {
    this.velocityY = Math.min(this.velocityY + gravity, maxFallSpeed);
  }

  // Adds to velocity instead of replacing it, so a hit never cancels a fall or a jump.
  applyKnockback(velocityX, velocityY) {
    this.knockbackVelocityX += velocityX;
    this.velocityY += velocityY;
  }

  overlaps(rectangle) {
    return (
      this.x < rectangle.x + rectangle.width &&
      this.x + this.width > rectangle.x &&
      this.y < rectangle.y + rectangle.height &&
      this.y + this.height > rectangle.y
    );
  }

  // The screen loops left to right, so an entity over an edge also meets the platforms one screen width over.
  platformsAcrossSeam(platforms) {
    const shifts = [];
    if (this.x < 0) shifts.push(-SCREEN_WIDTH);
    if (this.x + this.width > SCREEN_WIDTH) shifts.push(SCREEN_WIDTH);
    if (shifts.length === 0) return platforms;
    const shiftedPlatforms = shifts.flatMap((shift) =>
      platforms.map(({ x, y, width, height, oneWay }) => ({ x: x + shift, y, width, height, oneWay })),
    );
    return [...platforms, ...shiftedPlatforms];
  }

  // Moves one axis at a time so a corner cannot be resolved diagonally into a wall.
  moveAndCollide(platforms) {
    const totalVelocityX = this.velocityX + this.knockbackVelocityX;
    this.x += totalVelocityX;
    for (const platform of this.platformsAcrossSeam(platforms)) {
      if (platform.oneWay || !this.overlaps(platform)) continue;
      if (totalVelocityX > 0) this.x = platform.x - this.width;
      else if (totalVelocityX < 0) this.x = platform.x + platform.width;
      this.velocityX = 0;
      this.knockbackVelocityX = 0;
    }
    const knockbackDecay = this.knockbackDecay;
    if (this.knockbackVelocityX > 0) this.knockbackVelocityX = Math.max(0, this.knockbackVelocityX - knockbackDecay);
    else if (this.knockbackVelocityX < 0)
      this.knockbackVelocityX = Math.min(0, this.knockbackVelocityX + knockbackDecay);

    this.previousY = this.y;
    this.y += this.velocityY;
    this.onGround = false;
    for (const platform of this.platformsAcrossSeam(platforms)) {
      if (!this.overlaps(platform)) continue;
      // A one way platform only catches feet that were above its top before this move.
      if (platform.oneWay && (this.velocityY <= 0 || this.previousY + this.height > platform.y)) continue;
      if (this.velocityY > 0) {
        this.y = platform.y - this.height;
        this.onGround = true;
      } else if (this.velocityY < 0) {
        this.y = platform.y + platform.height;
      }
      this.velocityY = 0;
    }
  }
}
