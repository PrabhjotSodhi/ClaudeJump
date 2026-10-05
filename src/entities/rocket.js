import { SCREEN_WIDTH } from '../engine/config.js';
import { Entity } from '../engine/entity.js';

export const ROCKET_WIDTH = 12;
export const ROCKET_HEIGHT = 6;

const ROCKET_SPEED = 4.4;
const LIFETIME_TICKS = 240; // explodes on its own after 4 seconds so it can never circle forever

const BODY_COLOR = '#c85050';
const FLAME_COLOR = '#f0a028';
const GLOW_BODY_COLOR = '#f77622';
const GLOW_FLAME_COLOR = '#fee761';

// A rocket fired by a player. It flies straight and explodes on
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
    this.hitstopTicksRemaining = null;
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

  update(players, platforms) {
    if (this.exploded) return;

    this.ticksRemaining--;
    if (this.ticksRemaining <= 0) {
      this.explode();
      return;
    }

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
  render(context, { glowContext } = {}) {
    this.renderAt(context, glowContext, this.x);
    if (this.x < 0) this.renderAt(context, glowContext, this.x + SCREEN_WIDTH);
    else if (this.x + this.width > SCREEN_WIDTH) this.renderAt(context, glowContext, this.x - SCREEN_WIDTH);
  }

  // The glow layer gets brighter colors than the body, so the rocket glows orange and yellow.
  renderAt(context, glowContext, x) {
    const drawX = Math.round(x);
    const drawY = Math.round(this.y);
    context.fillStyle = FLAME_COLOR;
    context.fillRect(drawX, drawY + 2, 2, 2);
    context.fillStyle = BODY_COLOR;
    context.fillRect(drawX + 2, drawY, this.width - 2, this.height);
    if (!glowContext) return;
    glowContext.fillStyle = GLOW_FLAME_COLOR;
    glowContext.fillRect(drawX, drawY + 2, 2, 2);
    glowContext.fillStyle = GLOW_BODY_COLOR;
    glowContext.fillRect(drawX + 2, drawY, this.width - 2, this.height);
  }
}
