import { SCREEN_WIDTH } from '../engine/config.js';
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
const AIR_JUMP_MULTIPLIER = 0.85;
const COYOTE_TICKS = 6;
const JUMP_BUFFER_TICKS = 6;
const SINK_SPEED = 0.5;
const DASH_SPEED = 4.5;
const DASH_TICKS = 10;

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
    this.dizzyTicksRemaining = 0;
    this.airJumpAvailable = false;
    this.heldCardName = null;
    this.cardKeyHeldPrevious = false;
    this.playedCardName = null;
    this.dashTicksRemaining = 0;
  }

  startSinking() {
    this.inWater = true;
  }

  makeDizzy(tickCount) {
    this.dizzyTicksRemaining = tickCount;
  }

  refreshAirJump() {
    this.airJumpAvailable = true;
  }

  // A stomp forces the same rise a jump would give, full height held or a shorter hop not held.
  bounceFromStomp() {
    this.velocityY = this.jumpHeld ? JUMP_VELOCITY : JUMP_VELOCITY * JUMP_CUT_MULTIPLIER;
  }

  // The card key fires on the press, not while held, so keep tracking held state even when the
  // player cannot act, so a key already down does not fire the moment it becomes able to again.
  handleCardInput(input, canAct) {
    const pressed = input ? input.card : false;
    const justPressed = pressed && !this.cardKeyHeldPrevious;
    this.cardKeyHeldPrevious = pressed;
    if (justPressed && canAct) this.playCard();
  }

  receiveCard(cardName) {
    if (this.heldCardName) return false;
    this.heldCardName = cardName;
    return true;
  }

  playCard() {
    if (!this.heldCardName) return;
    this.playedCardName = this.heldCardName;
    this.heldCardName = null;
    if (this.playedCardName === 'dash') this.startDash();
  }

  startDash() {
    this.dashTicksRemaining = DASH_TICKS;
    this.velocityX = DASH_SPEED * this.facing;
  }

  update(input, platforms) {
    this.playedCardName = null;
    if (this.inWater) {
      this.y += SINK_SPEED;
      return;
    }

    this.handleCardInput(input, this.dizzyTicksRemaining <= 0);

    if (this.dizzyTicksRemaining > 0) {
      input = null;
      this.dizzyTicksRemaining--;
    }

    const moveDirection = input ? input.right - input.left : 0;
    const jumpPressed = input ? input.jump : false;
    if (jumpPressed && !this.jumpHeld) this.jumpBufferTicksRemaining = JUMP_BUFFER_TICKS;
    const jumpReleased = !jumpPressed && this.jumpHeld;
    this.jumpHeld = jumpPressed;
    if (moveDirection) this.facing = moveDirection;

    if (this.dashTicksRemaining > 0) {
      this.velocityX = DASH_SPEED * this.facing;
      this.dashTicksRemaining--;
    } else {
      const acceleration = this.onGround ? GROUND_ACCELERATION : AIR_ACCELERATION;
      this.velocityX += clamp(moveDirection * RUN_SPEED - this.velocityX, -acceleration, acceleration);
    }

    // Coyote time and the jump buffer forgive a press a few ticks early or late.
    if (this.onGround) this.airJumpAvailable = true;
    this.coyoteTicksRemaining = this.onGround ? COYOTE_TICKS : this.coyoteTicksRemaining - 1;
    this.jumpBufferTicksRemaining--;
    if (this.jumpBufferTicksRemaining > 0) {
      if (this.coyoteTicksRemaining > 0) {
        this.velocityY = JUMP_VELOCITY;
        this.jumpBufferTicksRemaining = 0;
        this.coyoteTicksRemaining = 0;
      } else if (this.airJumpAvailable) {
        this.velocityY = JUMP_VELOCITY * AIR_JUMP_MULTIPLIER;
        this.jumpBufferTicksRemaining = 0;
        this.airJumpAvailable = false;
      }
    }
    if (jumpReleased && this.velocityY < 0) this.velocityY *= JUMP_CUT_MULTIPLIER;

    this.applyGravity(GRAVITY, MAX_FALL_SPEED);
    this.moveAndCollide(platforms);
  }

  // Drawn a second time offset by a screen width while crossing an edge, so wrapping never shows a gap.
  render(context) {
    this.renderAt(context, this.x);
    if (this.x < 0) this.renderAt(context, this.x + SCREEN_WIDTH);
    else if (this.x + this.width > SCREEN_WIDTH) this.renderAt(context, this.x - SCREEN_WIDTH);
  }

  renderAt(context, x) {
    const drawX = Math.round(x);
    const drawY = Math.round(this.y);
    context.fillStyle = SKIN_COLOR;
    context.fillRect(drawX + 1, drawY, 6, 6);
    context.fillStyle = this.color;
    context.fillRect(drawX, drawY + 6, this.width, this.height - 6);
    context.fillStyle = EYE_COLOR;
    context.fillRect(drawX + (this.facing > 0 ? 5 : 2), drawY + 2, 1, 1);
  }
}
