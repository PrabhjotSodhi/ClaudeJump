import { PhysicsEntity } from '../engine/physics-entity.js';

export const PLAYER_WIDTH = 8;
export const PLAYER_HEIGHT = 12;

const GRAVITY = 0.3;
const MAX_FALL_SPEED = 6;
const RUN_SPEED = 1.8;
const GROUND_ACCELERATION = 0.35;
const AIR_ACCELERATION = 0.2;
const JUMP_VELOCITY = -5.2;
const JUMP_CUT_MULTIPLIER = 0.5;
const COYOTE_TICKS = 6;
const JUMP_BUFFER_TICKS = 6;
const SINK_SPEED = 0.5;

const SKIN_COLOR = '#f0c8a0';
const EYE_COLOR = '#1e1e28';

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export class Player extends PhysicsEntity {
  constructor({ id, color, spawnX, spawnY, facing }) {
    super({ x: spawnX - PLAYER_WIDTH / 2, y: spawnY - PLAYER_HEIGHT, width: PLAYER_WIDTH, height: PLAYER_HEIGHT });
    this.id = id;
    this.color = color;
    this.facing = facing;
    this.coyoteTicksRemaining = 0;
    this.jumpBufferTicksRemaining = 0;
    // Starts true so a jump key still held from the last round does not auto-jump on spawn.
    this.jumpHeld = true;
    this.inWater = false;
  }

  startSinking() {
    this.inWater = true;
  }

  update(input, platforms) {
    if (this.inWater) {
      this.y += SINK_SPEED;
      return;
    }

    const moveDirection = input ? input.right - input.left : 0;
    const jumpPressed = input ? input.jump : false;
    if (jumpPressed && !this.jumpHeld) this.jumpBufferTicksRemaining = JUMP_BUFFER_TICKS;
    const jumpReleased = !jumpPressed && this.jumpHeld;
    this.jumpHeld = jumpPressed;
    if (moveDirection) this.facing = moveDirection;

    const acceleration = this.onGround ? GROUND_ACCELERATION : AIR_ACCELERATION;
    this.velocityX += clamp(moveDirection * RUN_SPEED - this.velocityX, -acceleration, acceleration);

    // Coyote time and the jump buffer forgive a press a few ticks early or late.
    this.coyoteTicksRemaining = this.onGround ? COYOTE_TICKS : this.coyoteTicksRemaining - 1;
    this.jumpBufferTicksRemaining--;
    if (this.jumpBufferTicksRemaining > 0 && this.coyoteTicksRemaining > 0) {
      this.velocityY = JUMP_VELOCITY;
      this.jumpBufferTicksRemaining = 0;
      this.coyoteTicksRemaining = 0;
    }
    if (jumpReleased && this.velocityY < 0) this.velocityY *= JUMP_CUT_MULTIPLIER;

    this.applyGravity(GRAVITY, MAX_FALL_SPEED);
    this.moveAndCollide(platforms);
  }

  render(context) {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    context.fillStyle = SKIN_COLOR;
    context.fillRect(x + 1, y, 6, 6);
    context.fillStyle = this.color;
    context.fillRect(x, y + 6, this.width, this.height - 6);
    context.fillStyle = EYE_COLOR;
    context.fillRect(x + (this.facing > 0 ? 5 : 2), y + 2, 1, 1);
  }
}
