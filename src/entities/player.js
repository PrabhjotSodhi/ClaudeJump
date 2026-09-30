import { HITSTOP_TICKS, SCREEN_WIDTH } from '../engine/config.js';
import { PICKUP_USES } from '../cards/card-definitions.js';
import { PhysicsEntity } from '../engine/physics-entity.js';
import { drawCharacterBody, FRAME_SIZE } from '../vfx/character-body.js';

export const PLAYER_WIDTH = 24;
export const PLAYER_HEIGHT = 28;

const GRAVITY = 0.6;
const MAX_FALL_SPEED = 12;
const RUN_SPEED = 3.6;
const GROUND_ACCELERATION = 0.7;
const AIR_ACCELERATION = 0.4;
const JUMP_VELOCITY = -10.4;
const JUMP_CUT_MULTIPLIER = 0.5;
const AIR_JUMP_MULTIPLIER = 0.85;
const COYOTE_TICKS = 6;
const JUMP_BUFFER_TICKS = 6;
const SINK_SPEED = 1;
const DASH_SPEED = 9;
const DASH_TICKS = 10;
const SLIP_SPEED = 5;
const SLIP_STEER_SPEED = 0.5;
export const SHOVE_ACTIVE_TICKS = 6;
const SHOVE_COOLDOWN_TICKS = 30;
export const SHOVE_HIT_ZONE_WIDTH = 16;
export const SHOVE_HIT_ZONE_HEIGHT = 20;
export const SHOVE_KNOCKBACK_VELOCITY_X = 7;
export const SHOVE_KNOCKBACK_VELOCITY_Y = -4;

// Display only: how long, and by how many pixels, a player stretches after a jump and squashes
// after a landing. The hitbox never changes.
const STRETCH_TICKS = 6;
const STRETCH_PIXELS = 4;
const SQUASH_TICKS = 6;
const SQUASH_PIXELS = 4;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

export class Player extends PhysicsEntity {
  constructor({ id, character, spawnX, spawnY, facing }) {
    super({ x: spawnX - PLAYER_WIDTH / 2, y: spawnY - PLAYER_HEIGHT, width: PLAYER_WIDTH, height: PLAYER_HEIGHT });
    this.id = id;
    this.character = character;
    this.color = character.tagColor;
    this.facing = facing;
    this.coyoteTicksRemaining = 0;
    this.jumpBufferTicksRemaining = 0;
    // Starts true so a jump key still held from the last round does not auto-jump on spawn.
    this.jumpHeld = true;
    this.inWater = false;
    this.slipTicksRemaining = 0;
    this.slipDirection = 0;
    this.airJumpAvailable = false;
    this.heldCardName = null;
    this.heldCardUsesRemaining = 0;
    this.actionKeyHeldPrevious = false;
    this.playedCardName = null;
    this.dashTicksRemaining = 0;
    this.shoveActiveTicksRemaining = 0;
    this.shoveCooldownTicksRemaining = 0;
    this.shoveJustStarted = false;
    this.hitstopTicksRemaining = 0;
    this.pendingKnockbackVelocityX = 0;
    this.pendingKnockbackVelocityY = 0;
    this.ticksSinceJump = STRETCH_TICKS;
    this.ticksSinceLanding = SQUASH_TICKS;
  }

  // Extra width and height to draw with, in whole pixels. The more recent of a jump and a landing wins.
  get squash() {
    const stretching = this.ticksSinceJump < STRETCH_TICKS;
    const squashing = this.ticksSinceLanding < SQUASH_TICKS;
    if (squashing && (!stretching || this.ticksSinceLanding <= this.ticksSinceJump)) {
      return { width: SQUASH_PIXELS, height: -SQUASH_PIXELS };
    }
    if (stretching) return { width: -STRETCH_PIXELS, height: STRETCH_PIXELS };
    return { width: 0, height: 0 };
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

  get isFrozen() {
    return this.hitstopTicksRemaining > 0;
  }

  // Holds the player still for the hit's freeze, then launches them with the given knockback. The hitter
  // freezes with no knockback. A second hit while frozen keeps the longer freeze and adds the knockbacks.
  freeze(strength, knockbackVelocityX = 0, knockbackVelocityY = 0) {
    this.hitstopTicksRemaining = Math.max(this.hitstopTicksRemaining, HITSTOP_TICKS[strength]);
    this.pendingKnockbackVelocityX += knockbackVelocityX;
    this.pendingKnockbackVelocityY += knockbackVelocityY;
  }

  // A frozen player ignores input, and a button held through the freeze does not fire when it ends.
  updateFrozen(input) {
    this.handleActionInput(input, false);
    this.jumpHeld = input ? input.jump : false;
    this.hitstopTicksRemaining--;
    if (this.hitstopTicksRemaining > 0) return;
    this.applyKnockback(this.pendingKnockbackVelocityX, this.pendingKnockbackVelocityY);
    this.pendingKnockbackVelocityX = 0;
    this.pendingKnockbackVelocityY = 0;
  }

  startSinking() {
    this.inWater = true;
  }

  // Keeps sliding the way they were moving; a player standing still slides the way they face.
  makeSlip(tickCount) {
    this.slipTicksRemaining = tickCount;
    this.slipDirection = Math.sign(this.velocityX + this.knockbackVelocityX) || this.facing;
  }

  launchUpward(velocityY) {
    this.velocityY = velocityY;
    this.onGround = false;
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
    this.heldCardUsesRemaining = PICKUP_USES;
    return true;
  }

  playCard() {
    if (!this.heldCardName) return;
    this.playedCardName = this.heldCardName;
    this.heldCardUsesRemaining--;
    if (this.heldCardUsesRemaining <= 0) this.heldCardName = null;
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
    this.ticksSinceJump = Math.min(this.ticksSinceJump + 1, STRETCH_TICKS);
    this.ticksSinceLanding = Math.min(this.ticksSinceLanding + 1, SQUASH_TICKS);
    const wasOnGround = this.onGround;
    if (this.inWater) {
      this.y += SINK_SPEED;
      return;
    }
    if (this.isFrozen) {
      this.updateFrozen(input);
      return;
    }

    const slipping = this.slipTicksRemaining > 0;
    this.handleActionInput(input, !slipping);

    const moveDirection = input ? input.right - input.left : 0;
    const jumpPressed = input && !slipping ? input.jump : false;
    if (jumpPressed && !this.jumpHeld) this.jumpBufferTicksRemaining = JUMP_BUFFER_TICKS;
    const jumpReleased = !jumpPressed && this.jumpHeld;
    this.jumpHeld = jumpPressed;
    if (moveDirection && !slipping) this.facing = moveDirection;

    if (this.dashTicksRemaining > 0) {
      this.velocityX = DASH_SPEED * this.facing;
      this.dashTicksRemaining--;
    } else if (slipping) {
      this.velocityX = this.slipDirection * SLIP_SPEED + moveDirection * SLIP_STEER_SPEED;
      this.slipTicksRemaining--;
    } else {
      const acceleration = this.onGround ? GROUND_ACCELERATION : AIR_ACCELERATION;
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
        this.ticksSinceJump = 0;
        this.jumpBufferTicksRemaining = 0;
        this.coyoteTicksRemaining = 0;
      } else if (this.airJumpAvailable) {
        this.velocityY = JUMP_VELOCITY * AIR_JUMP_MULTIPLIER;
        this.ticksSinceJump = 0;
        this.jumpBufferTicksRemaining = 0;
        this.airJumpAvailable = false;
      }
    }
    if (jumpReleased && this.velocityY < 0) this.velocityY *= JUMP_CUT_MULTIPLIER;

    this.applyGravity(GRAVITY, MAX_FALL_SPEED);
    this.moveAndCollide(platforms);
    if (this.onGround && !wasOnGround) this.ticksSinceLanding = 0;
  }

  // Drawn a second time offset by a screen width while crossing an edge, so wrapping never shows a gap.
  // appearance is { sprites, playerEyes }: the loaded sprite files by name and the display only eyes.
  render(context, appearance) {
    this.renderAt(context, this.x, appearance);
    if (this.x < 0) this.renderAt(context, this.x + SCREEN_WIDTH, appearance);
    else if (this.x + this.width > SCREEN_WIDTH) this.renderAt(context, this.x - SCREEN_WIDTH, appearance);
  }

  // The sprite frame sits bottom centered on the hitbox, one pixel lower so its white outline row overlaps the
  // top row of the platform underfoot.
  renderAt(context, x, { sprites, playerEyes }) {
    const drawX = Math.round(x);
    const drawY = Math.round(this.y);
    if (this.isShoveActive) {
      const hitZone = this.shoveHitZone;
      context.fillStyle = this.color;
      context.fillRect(Math.round(drawX + (hitZone.x - this.x)), Math.round(hitZone.y), hitZone.width, hitZone.height);
    }
    const squash = this.inWater ? { width: 0, height: 0 } : this.squash;
    drawCharacterBody(context, {
      sprite: sprites[this.character.spriteName].body,
      eyeFramePositions: this.character.eyeFramePositions,
      eyes: playerEyes.eyesFor(this.id),
      centerX: drawX + this.width / 2,
      bottomY: drawY + this.height + 1,
      width: FRAME_SIZE + squash.width,
      height: FRAME_SIZE + squash.height,
    });
  }
}
