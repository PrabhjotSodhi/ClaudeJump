import { SHOVE_COOLDOWN_TICKS } from '../entities/player.js';
import { chargeProgressOf } from './character-animations.js';

// Display only: the small shovel a player swings when they shove. It reads the shove timers and never changes
// them, so hit zones and timing stay the same with or without it.

// Where the grip sits in each 16x16 frame of data/sprites/props.json, drawn facing right. The grip is held at
// the front edge of the body.
const GRIP_BY_FRAME = {
  'shovel-up': [2, 15],
  'shovel-raised': [0, 11],
  'shovel-forward': [0, 8],
  'shovel-down': [0, 4],
};
const FRAME_SIZE = 16;
// Ticks after firing: the blade sweeps out level, follows through low, then pulls back before it is put away.
const SWEEP_TICKS = 2;
const FOLLOW_THROUGH_TICKS = 6;
const PULL_BACK_TICKS = 12;
const PULL_BACK_PIXELS = 4;
// While winding up and charging, the shovel is held back behind the front edge and rises with the charge.
const HOLD_BACK_PIXELS = 4;
const MAX_CHARGE_LIFT_PIXELS = 4;
const HIGH_CHARGE_PROGRESS = 0.5;

// The frame and the offset from the grip, in pixels toward the facing direction and down, or null when no
// shovel shows.
export function shovelPose(player) {
  if (player.inWater) return null;
  if (player.shoveCharging) {
    const progress = chargeProgressOf(player);
    return {
      frame: progress < HIGH_CHARGE_PROGRESS ? 'shovel-raised' : 'shovel-up',
      offsetX: -HOLD_BACK_PIXELS,
      offsetY: -Math.round(progress * MAX_CHARGE_LIFT_PIXELS),
    };
  }
  if (player.shoveCooldownTicksRemaining <= 0) return null;
  const ticksSinceFire = SHOVE_COOLDOWN_TICKS - player.shoveCooldownTicksRemaining;
  if (ticksSinceFire < SWEEP_TICKS) return { frame: 'shovel-forward', offsetX: 0, offsetY: 0 };
  if (ticksSinceFire < FOLLOW_THROUGH_TICKS) return { frame: 'shovel-down', offsetX: 0, offsetY: 0 };
  if (ticksSinceFire < PULL_BACK_TICKS) return { frame: 'shovel-down', offsetX: -PULL_BACK_PIXELS, offsetY: 0 };
  return null;
}

// Draws the shovel for a player whose body is drawn at drawX, drawY. Mirrored whole, so it stays on whole pixels.
export function drawShovel(context, player, drawX, drawY, props) {
  const pose = shovelPose(player);
  if (!pose) return;
  const [gripX, gripY] = GRIP_BY_FRAME[pose.frame];
  const handX = player.facing > 0 ? drawX + player.width : drawX;
  const handY = drawY + Math.round(player.height / 2) + pose.offsetY;
  context.save();
  context.translate(handX + player.facing * pose.offsetX, handY);
  context.scale(player.facing, 1);
  context.drawImage(props[pose.frame], -gripX, -gripY, FRAME_SIZE, FRAME_SIZE);
  context.restore();
}
