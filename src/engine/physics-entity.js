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

  // Moves one axis at a time so a corner cannot be resolved diagonally into a wall.
  moveAndCollide(platforms) {
    const totalVelocityX = this.velocityX + this.knockbackVelocityX;
    this.x += totalVelocityX;
    for (const platform of platforms) {
      if (!this.overlaps(platform)) continue;
      if (totalVelocityX > 0) this.x = platform.x - this.width;
      else if (totalVelocityX < 0) this.x = platform.x + platform.width;
      this.velocityX = 0;
      this.knockbackVelocityX = 0;
    }
    const knockbackDecay = this.onGround ? GROUND_KNOCKBACK_DECAY : AIR_KNOCKBACK_DECAY;
    if (this.knockbackVelocityX > 0) this.knockbackVelocityX = Math.max(0, this.knockbackVelocityX - knockbackDecay);
    else if (this.knockbackVelocityX < 0)
      this.knockbackVelocityX = Math.min(0, this.knockbackVelocityX + knockbackDecay);

    this.previousY = this.y;
    this.y += this.velocityY;
    this.onGround = false;
    for (const platform of platforms) {
      if (!this.overlaps(platform)) continue;
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
