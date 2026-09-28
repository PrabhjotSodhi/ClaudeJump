import { SCREEN_WIDTH } from '../engine/config.js';
import { PhysicsEntity } from '../engine/physics-entity.js';

export const PLAYER_WIDTH = 24;
export const PLAYER_HEIGHT = 28;

const GRAVITY = 0.6;
const MAX_FALL_SPEED = 12;
const RUN_SPEED = 3.6;
const GROUND_ACCELERATION = 0.7;
const AIR_ACCELERATION = 0.4;
// A sharp drop from GROUND_ACCELERATION so a player on ice slides and struggles to stop.
const ICE_GROUND_ACCELERATION = 0.1;
const JUMP_VELOCITY = -10.4;
const JUMP_CUT_MULTIPLIER = 0.5;
const AIR_JUMP_MULTIPLIER = 0.85;
const COYOTE_TICKS = 6;
const JUMP_BUFFER_TICKS = 6;
const SINK_SPEED = 1;
const DASH_SPEED = 9;
const DASH_TICKS = 10;
export const SHOVE_ACTIVE_TICKS = 6;
const SHOVE_COOLDOWN_TICKS = 30;
export const SHOVE_HIT_ZONE_WIDTH = 16;
export const SHOVE_HIT_ZONE_HEIGHT = 20;

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
    this.actionKeyHeldPrevious = false;
    this.playedCardName = null;
    this.dashTicksRemaining = 0;
    this.shoveActiveTicksRemaining = 0;
    this.shoveCooldownTicksRemaining = 0;
    this.shoveJustStarted = false;
  }

  get isShoveActive() {
    return this.shoveActiveTicksRemaining > 0;
  }

  // Sits just in front of the player, facing the way they are facing, so an opponent behind them
  // is never inside it.
  get shoveHitZone() {
    const x = this.facing > 0 ? this.x + this.width : this.x - SHOVE_HIT_ZONE_WIDTH;
    const y = this.y + this.height / 2 - SHOVE_HIT_ZONE_HEIGHT / 2;
    return { x, y, width: SHOVE_HIT_ZONE_WIDTH, height: SHOVE_HIT_ZONE_HEIGHT };
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

  launchUpward(velocityY) {
    this.velocityY = velocityY;
    this.onGround = false;
  }

  // A stomp forces the same rise a jump would give, full height held or a shorter hop not held.
  bounceFromStomp() {
    this.velocityY = this.jumpHeld ? JUMP_VELOCITY : JUMP_VELOCITY * JUMP_CUT_MULTIPLIER;
  }

  // The action key fires on the press, not while held, so keep tracking held state even when the
  // player cannot act, so a key already down does not fire the moment it becomes able to again.
  // A held pickup takes over the button; with nothing held, it shoves instead.
  handleActionInput(input, canAct) {
    const pressed = input ? input.action : false;
    const justPressed = pressed && !this.actionKeyHeldPrevious;
    this.actionKeyHeldPrevious = pressed;
    if (!justPressed || !canAct) return;
    if (this.heldCardName) this.playCard();
    else this.startShove();
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

  // The cooldown covers the active ticks too, so it is the whole gap between one shove and the next.
  startShove() {
    if (this.shoveActiveTicksRemaining > 0 || this.shoveCooldownTicksRemaining > 0) return;
    this.shoveActiveTicksRemaining = SHOVE_ACTIVE_TICKS;
    this.shoveCooldownTicksRemaining = SHOVE_COOLDOWN_TICKS;
    this.shoveJustStarted = true;
  }

  update(input, platforms) {
    this.playedCardName = null;
    this.shoveJustStarted = false;
    if (this.inWater) {
      this.y += SINK_SPEED;
      return;
    }

    this.handleActionInput(input, this.dizzyTicksRemaining <= 0);

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
      const onIcyGround = this.onGround && this.standingPlatform?.isIcy;
      const acceleration = onIcyGround
        ? ICE_GROUND_ACCELERATION
        : this.onGround
          ? GROUND_ACCELERATION
          : AIR_ACCELERATION;
      this.velocityX += clamp(moveDirection * RUN_SPEED - this.velocityX, -acceleration, acceleration);
    }

    if (this.shoveActiveTicksRemaining > 0) this.shoveActiveTicksRemaining--;
    if (this.shoveCooldownTicksRemaining > 0) this.shoveCooldownTicksRemaining--;

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
    if (this.isShoveActive) {
      const hitZone = this.shoveHitZone;
      context.fillStyle = this.color;
      context.fillRect(Math.round(drawX + (hitZone.x - this.x)), Math.round(hitZone.y), hitZone.width, hitZone.height);
    }
    context.fillStyle = SKIN_COLOR;
    context.fillRect(drawX + 4, drawY, 16, 14);
    context.fillStyle = this.color;
    context.fillRect(drawX, drawY + 14, this.width, this.height - 14);
    context.fillStyle = EYE_COLOR;
    context.fillRect(drawX + (this.facing > 0 ? 16 : 6), drawY + 5, 2, 2);
  }
}
