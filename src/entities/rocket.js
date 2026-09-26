import { SCREEN_WIDTH } from '../engine/config.js';
import { Entity } from '../engine/entity.js';

export const ROCKET_WIDTH = 6;
export const ROCKET_HEIGHT = 3;

const ROCKET_SPEED = 2.2;
// How much the rocket's velocity may turn toward its target each tick, so it curves gently
// instead of snapping to face the opponent.
const STEER_ACCELERATION = 0.05;
const LIFETIME_TICKS = 240; // explodes on its own after 4 seconds so it can never circle forever

const BODY_COLOR = '#c85050';
const FLAME_COLOR = '#f0a028';

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

// A rocket fired by a player. It steers gently toward the nearest opponent and explodes on
// hitting a player, a platform or its own lifetime running out. The explosion itself, and who
// it knocks back, is resolved by the scene so it can apply applyKnockback to every player.
export class Rocket extends Entity {
  constructor({ x, y, facing, shooterId }) {
    super({ x, y, width: ROCKET_WIDTH, height: ROCKET_HEIGHT });
    this.shooterId = shooterId;
    this.velocityX = ROCKET_SPEED * facing;
    this.velocityY = 0;
    this.ticksRemaining = LIFETIME_TICKS;
    this.exploded = false;
  }

  explode() {
    this.exploded = true;
  }

  overlaps(rectangle) {
    return (
      this.x < rectangle.x + rectangle.width &&
      this.x + this.width > rectangle.x &&
      this.y < rectangle.y + rectangle.height &&
      this.y + this.height > rectangle.y
    );
  }

  findTarget(players) {
    const opponents = players.filter((player) => player.id !== this.shooterId && !player.inWater);
    if (opponents.length === 0) return null;

    const rocketCenterX = this.x + this.width / 2;
    const rocketCenterY = this.y + this.height / 2;
    return opponents.reduce((closest, candidate) => {
      const candidateDistance = Math.hypot(
        candidate.x + candidate.width / 2 - rocketCenterX,
        candidate.y + candidate.height / 2 - rocketCenterY,
      );
      const closestDistance = Math.hypot(
        closest.x + closest.width / 2 - rocketCenterX,
        closest.y + closest.height / 2 - rocketCenterY,
      );
      return candidateDistance < closestDistance ? candidate : closest;
    });
  }

  steerToward(targetX, targetY) {
    const directionX = targetX - (this.x + this.width / 2);
    const directionY = targetY - (this.y + this.height / 2);
    const distance = Math.hypot(directionX, directionY) || 1;
    const desiredVelocityX = (directionX / distance) * ROCKET_SPEED;
    const desiredVelocityY = (directionY / distance) * ROCKET_SPEED;
    this.velocityX += clamp(desiredVelocityX - this.velocityX, -STEER_ACCELERATION, STEER_ACCELERATION);
    this.velocityY += clamp(desiredVelocityY - this.velocityY, -STEER_ACCELERATION, STEER_ACCELERATION);
  }

  update(players, platforms) {
    if (this.exploded) return;

    this.ticksRemaining--;
    if (this.ticksRemaining <= 0) {
      this.explode();
      return;
    }

    const target = this.findTarget(players);
    if (target) this.steerToward(target.x + target.width / 2, target.y + target.height / 2);

    this.x += this.velocityX;
    this.y += this.velocityY;

    for (const platform of platforms) {
      if (this.overlaps(platform)) {
        this.explode();
        return;
      }
    }
    for (const player of players) {
      if (player.id === this.shooterId || player.inWater) continue;
      if (this.overlaps(player)) {
        this.explode();
        return;
      }
    }
  }

  // Drawn a second time offset by a screen width while crossing an edge, the way Player.render does,
  // so a rocket never appears unannounced from off screen.
  render(context) {
    this.renderAt(context, this.x);
    if (this.x < 0) this.renderAt(context, this.x + SCREEN_WIDTH);
    else if (this.x + this.width > SCREEN_WIDTH) this.renderAt(context, this.x - SCREEN_WIDTH);
  }

  renderAt(context, x) {
    const drawX = Math.round(x);
    const drawY = Math.round(this.y);
    context.fillStyle = FLAME_COLOR;
    context.fillRect(drawX, drawY + 1, 1, 1);
    context.fillStyle = BODY_COLOR;
    context.fillRect(drawX + 1, drawY, this.width - 1, this.height);
  }
}
