import { ICE_SHOT_LIFETIME_TICKS, ICE_SHOT_SPEED, SCREEN_WIDTH } from '../engine/config.js';
import { Entity } from '../engine/entity.js';

export const ICE_SHOT_WIDTH = 8;
export const ICE_SHOT_HEIGHT = 6;

const EDGE_COLOR = '#0099db';
const CORE_COLOR = '#2ce8f5';
const GLINT_COLOR = '#ffffff';

// A shard of ice thrown by the freeze card. It flies straight and stops on the first other player it touches,
// a platform or the end of its lifetime. The scene freezes the player in `hitPlayerId`.
export class IceShot extends Entity {
  constructor({ x, y, facing, shooterId }) {
    super({ x, y, width: ICE_SHOT_WIDTH, height: ICE_SHOT_HEIGHT });
    this.shooterId = shooterId;
    this.velocityX = ICE_SHOT_SPEED * facing;
    this.ticksRemaining = ICE_SHOT_LIFETIME_TICKS;
    this.finished = false;
    this.hitPlayerId = null;
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
    if (this.finished) return;

    this.ticksRemaining--;
    this.x += this.velocityX;
    const hitPlayer = players.find(
      (player) => player.id !== this.shooterId && !player.inWater && this.overlaps(player),
    );
    if (hitPlayer) this.hitPlayerId = hitPlayer.id;
    if (hitPlayer || this.ticksRemaining <= 0 || platforms.some((platform) => this.overlaps(platform))) {
      this.finished = true;
    }
  }

  // Drawn a second time offset by a screen width while crossing an edge, like the rocket.
  render(context) {
    this.renderAt(context, this.x);
    if (this.x < 0) this.renderAt(context, this.x + SCREEN_WIDTH);
    else if (this.x + this.width > SCREEN_WIDTH) this.renderAt(context, this.x - SCREEN_WIDTH);
  }

  renderAt(context, x) {
    const drawX = Math.round(x);
    const drawY = Math.round(this.y);
    context.fillStyle = EDGE_COLOR;
    context.fillRect(drawX + 2, drawY, this.width - 4, this.height);
    context.fillRect(drawX, drawY + 1, this.width, this.height - 2);
    context.fillStyle = CORE_COLOR;
    context.fillRect(drawX + 1, drawY + 2, this.width - 2, 2);
    context.fillStyle = GLINT_COLOR;
    context.fillRect(drawX + 2, drawY + 2, 2, 1);
  }
}
