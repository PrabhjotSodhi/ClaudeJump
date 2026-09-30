import { SCREEN_WIDTH } from '../engine/config.js';
import { Entity } from '../engine/entity.js';

export const BOMB_WIDTH = 8;
export const BOMB_HEIGHT = 8;

const BOMB_THROW_VELOCITY_X = 5;
const BOMB_THROW_VELOCITY_Y = -6;
const BOMB_GRAVITY = 0.6;
const BOMB_FUSE_TICKS = 90;

const BODY_COLOR = '#282832';
const FUSE_COLOR = '#f0a028';

// A bomb lobbed by a player. It arcs forward and explodes on touching a platform, a player other
// than the thrower, the sea, or its fuse running out. The blast itself is resolved by the scene.
export class Bomb extends Entity {
  constructor({ x, y, facing, throwerId }) {
    super({ x, y, width: BOMB_WIDTH, height: BOMB_HEIGHT });
    this.throwerId = throwerId;
    this.velocityX = BOMB_THROW_VELOCITY_X * facing;
    this.velocityY = BOMB_THROW_VELOCITY_Y;
    this.ticksRemaining = BOMB_FUSE_TICKS;
    this.exploded = false;
    this.hitstopTicksRemaining = null;
  }

  overlaps(rectangle) {
    return (
      this.x < rectangle.x + rectangle.width &&
      this.x + this.width > rectangle.x &&
      this.y < rectangle.y + rectangle.height &&
      this.y + this.height > rectangle.y
    );
  }

  update(players, platforms, waterLineY) {
    if (this.exploded) return;

    this.ticksRemaining--;
    this.velocityY += BOMB_GRAVITY;
    this.x += this.velocityX;
    this.y += this.velocityY;

    this.exploded =
      this.ticksRemaining <= 0 ||
      this.y + this.height >= waterLineY ||
      platforms.some((platform) => this.overlaps(platform)) ||
      players.some((player) => player.id !== this.throwerId && !player.inWater && this.overlaps(player));
  }

  // Drawn a second time offset by a screen width while crossing an edge, the way Rocket.render does.
  render(context) {
    this.renderAt(context, this.x);
    if (this.x < 0) this.renderAt(context, this.x + SCREEN_WIDTH);
    else if (this.x + this.width > SCREEN_WIDTH) this.renderAt(context, this.x - SCREEN_WIDTH);
  }

  renderAt(context, x) {
    const drawX = Math.round(x);
    const drawY = Math.round(this.y);
    context.fillStyle = BODY_COLOR;
    context.fillRect(drawX, drawY + 2, this.width, this.height - 2);
    context.fillStyle = FUSE_COLOR;
    context.fillRect(drawX + 3, drawY, 2, 2);
  }
}
