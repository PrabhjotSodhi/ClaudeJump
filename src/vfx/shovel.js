import { SHOVE_HIT_ZONE_WIDTH, SHOVE_WINDUP_TICKS } from '../engine/config.js';
import { SHOVE_COOLDOWN_TICKS } from '../entities/player.js';
import { chargeProgressOf } from './character-animations.js';

// Display only: the shovel a player swings when they shove. It reads the shove timers and never changes them, so
// hit zones and timing stay the same with or without it.

// Every shovel frame in data/sprites/props.json is drawn facing right with the grip at its center.
const GRIP = 24;
// While charging, the hands go up to the top of the body and back, and the shovel is held behind the head.
const BACK_CHARGE_PROGRESS = 0.5;
const CHARGE_HOLD_BACK_PIXELS = 4;
const CHARGE_LIFT_PIXELS = 8;
const MAX_EXTRA_CHARGE_LIFT_PIXELS = 3;
// Ticks after firing: a smear through the swing, a low follow-through, then the pull back.
const SMEAR_TICKS = 2;
const IMPACT_TICKS = 6;
const FOLLOW_THROUGH_TICKS = 12;
const PULL_BACK_TICKS = 18;
const PULL_BACK_PIXELS = 4;
// The last column of each swing frame that has paint in it, the tip of the blade.
const BLADE_TIP_COLUMNS = { 'shovel-smear': 45, 'shovel-forward': 45, 'shovel-down': 39 };
// At the height of the blade, the side of a character's drawn body, outlines included, sits anywhere from 1 pixel
// inside its hitbox to 4 pixels outside it.
const MIN_BODY_OVERHANG = -1;
const MAX_BODY_OVERHANG = 4;
const CONTACT_PIXELS = 2;
// How far the blade tip reaches past the front of the body. A swing that misses stops short of any body outside the
// hit zone. A swing that lands pushes into a body even at the far edge of the hit zone.
export const MISS_REACH_PIXELS = SHOVE_HIT_ZONE_WIDTH - MAX_BODY_OVERHANG;
export const HIT_REACH_PIXELS = SHOVE_HIT_ZONE_WIDTH - 1 - MIN_BODY_OVERHANG + CONTACT_PIXELS;
const PUFF_COLORS = ['#c0cbdc', '#8b9bb4'];
// Each tick of the puff: how far its four specks sit from the middle and how big they are.
const PUFF_STEPS = [
  { distance: 0, size: 4 },
  { distance: 3, size: 3 },
  { distance: 6, size: 2 },
  { distance: 8, size: 2 },
];

function swingPose(frame, reachPixels) {
  const offsetX = reachPixels - (BLADE_TIP_COLUMNS[frame] + 1 - GRIP);
  return { frame, offsetX, offsetY: 0, puffAge: null, layer: 'front' };
}

// The shover holds still in the hit freeze while the blade is in the target. Being hit freezes too, but with knockback.
function isConnecting(player) {
  return player.isFrozen && player.pendingKnockbackVelocityX === 0 && player.pendingKnockbackVelocityY === 0;
}

// The frame, the offset from the grip in pixels toward the facing direction and down, the age of the impact puff
// (null when none shows) and the layer it is drawn on: 'behind' the body, in 'front' of it, or 'over-players' so a
// blade in a target shows on top of them. Null when no shovel shows.
export function shovelPose(player) {
  if (player.inWater) return null;
  if (player.shoveCharging) {
    const progress = chargeProgressOf(player);
    let frame = 'shovel-raised';
    if (player.shoveChargeTicks < SHOVE_WINDUP_TICKS) frame = 'shovel-up';
    else if (progress >= BACK_CHARGE_PROGRESS) frame = 'shovel-back';
    const offsetY = -CHARGE_LIFT_PIXELS - Math.round(progress * MAX_EXTRA_CHARGE_LIFT_PIXELS);
    return { frame, offsetX: -CHARGE_HOLD_BACK_PIXELS, offsetY, puffAge: null, layer: 'behind' };
  }
  if (player.shoveCooldownTicksRemaining <= 0) return null;
  const ticksSinceFire = SHOVE_COOLDOWN_TICKS - player.shoveCooldownTicksRemaining;
  if (ticksSinceFire < IMPACT_TICKS && isConnecting(player)) {
    const puffAge = Math.max(0, PUFF_STEPS.length - player.hitstopTicksRemaining);
    return { ...swingPose('shovel-forward', HIT_REACH_PIXELS), puffAge, layer: 'over-players' };
  }
  if (ticksSinceFire < SMEAR_TICKS) return swingPose('shovel-smear', MISS_REACH_PIXELS);
  if (ticksSinceFire < IMPACT_TICKS) return swingPose('shovel-forward', MISS_REACH_PIXELS);
  if (ticksSinceFire < FOLLOW_THROUGH_TICKS) return swingPose('shovel-down', MISS_REACH_PIXELS);
  if (ticksSinceFire < PULL_BACK_TICKS) return swingPose('shovel-down', MISS_REACH_PIXELS - PULL_BACK_PIXELS);
  return null;
}

// The puff centers where the blade meets a target at the far edge of the hit zone. centerX is measured from the
// grip in the drawn direction.
function drawPuff(context, age, centerX) {
  const { distance, size } = PUFF_STEPS[age];
  context.fillStyle = PUFF_COLORS[age < 2 ? 0 : 1];
  const half = Math.floor(size / 2);
  for (const [directionX, directionY] of [
    [1, -1],
    [1, 1],
    [-1, -1],
    [-1, 1],
  ]) {
    context.fillRect(centerX + directionX * distance - half, directionY * distance - half, size, size);
  }
}

// Draws the shovel for a player whose body is drawn at drawX, drawY, when it belongs on the given layer. Called before
// the body, after it, and after every player. Mirrored whole, so it stays on whole pixels.
export function drawShovel(context, player, drawX, drawY, props, layer) {
  const pose = shovelPose(player);
  if (!pose || pose.layer !== layer) return;
  const handX = player.facing > 0 ? drawX + player.width : drawX;
  const handY = drawY + Math.round(player.height / 2) + pose.offsetY;
  const image = props[pose.frame];
  context.save();
  context.translate(handX + player.facing * pose.offsetX, handY);
  context.scale(player.facing, 1);
  context.drawImage(image, -GRIP, -GRIP, image.width, image.height);
  if (pose.puffAge !== null) drawPuff(context, pose.puffAge, HIT_REACH_PIXELS - CONTACT_PIXELS - pose.offsetX);
  context.restore();
}
