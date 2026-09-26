import { Entity } from './entity.js';

export class PhysicsEntity extends Entity {
  constructor({ x, y, width, height }) {
    super({ x, y, width, height });
    this.velocityX = 0;
    this.velocityY = 0;
    this.onGround = false;
  }

  applyGravity(gravity, maxFallSpeed) {
    this.velocityY = Math.min(this.velocityY + gravity, maxFallSpeed);
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
    this.x += this.velocityX;
    for (const platform of platforms) {
      if (!this.overlaps(platform)) continue;
      if (this.velocityX > 0) this.x = platform.x - this.width;
      else if (this.velocityX < 0) this.x = platform.x + platform.width;
      this.velocityX = 0;
    }

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
