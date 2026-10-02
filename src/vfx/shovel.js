import { SHOVE_WINDUP_TICKS } from '../engine/config.js';
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
// Ticks after firing: a smear through the hit, the impact with its puff, a low follow-through, then the pull back.
const SMEAR_TICKS = 2;
const IMPACT_TICKS = 6;
const FOLLOW_THROUGH_TICKS = 12;
const PULL_BACK_TICKS = 18;
const SMEAR_REACH_PIXELS = 2;
const PULL_BACK_PIXELS = 4;
// The puff sits just past the tip of the blade, this far in front of the grip.
const PUFF_REACH_PIXELS = 24;
const PUFF_COLORS = ['#c0cbdc', '#8b9bb4'];
// Each tick of the puff: how far its four specks sit from the middle and how big they are.
const PUFF_STEPS = [
  { distance: 0, size: 4 },
  { distance: 3, size: 3 },
  { distance: 6, size: 2 },
  { distance: 8, size: 2 },
];

// The frame, the offset from the grip in pixels toward the facing direction and down, the age of the impact puff
// (null when none shows) and whether it is drawn behind the body. Null when no shovel shows.
export function shovelPose(player) {
  if (player.inWater) return null;
  if (player.shoveCharging) {
    const progress = chargeProgressOf(player);
    let frame = 'shovel-raised';
    if (player.shoveChargeTicks < SHOVE_WINDUP_TICKS) frame = 'shovel-up';
    else if (progress >= BACK_CHARGE_PROGRESS) frame = 'shovel-back';
    const offsetY = -CHARGE_LIFT_PIXELS - Math.round(progress * MAX_EXTRA_CHARGE_LIFT_PIXELS);
    return { frame, offsetX: -CHARGE_HOLD_BACK_PIXELS, offsetY, puffAge: null, behindBody: true };
  }
  if (player.shoveCooldownTicksRemaining <= 0) return null;
  const ticksSinceFire = SHOVE_COOLDOWN_TICKS - player.shoveCooldownTicksRemaining;
  const swing = { offsetX: 0, offsetY: 0, puffAge: null, behindBody: false };
  if (ticksSinceFire < SMEAR_TICKS) return { ...swing, frame: 'shovel-smear', offsetX: SMEAR_REACH_PIXELS };
  if (ticksSinceFire < IMPACT_TICKS)
    return { ...swing, frame: 'shovel-forward', puffAge: ticksSinceFire - SMEAR_TICKS };
  if (ticksSinceFire < FOLLOW_THROUGH_TICKS) return { ...swing, frame: 'shovel-down' };
  if (ticksSinceFire < PULL_BACK_TICKS) return { ...swing, frame: 'shovel-down', offsetX: -PULL_BACK_PIXELS };
  return null;
}

function drawPuff(context, age) {
  const { distance, size } = PUFF_STEPS[age];
  context.fillStyle = PUFF_COLORS[age < 2 ? 0 : 1];
  const half = Math.floor(size / 2);
  for (const [directionX, directionY] of [
    [1, -1],
    [1, 1],
    [-1, -1],
    [-1, 1],
  ]) {
    context.fillRect(PUFF_REACH_PIXELS + directionX * distance - half, directionY * distance - half, size, size);
  }
}

// Draws the shovel for a player whose body is drawn at drawX, drawY, when it belongs on the given side of the body.
// Called once before the body and once after. Mirrored whole, so it stays on whole pixels.
export function drawShovel(context, player, drawX, drawY, props, behindBody) {
  const pose = shovelPose(player);
  if (!pose || pose.behindBody !== behindBody) return;
  const handX = player.facing > 0 ? drawX + player.width : drawX;
  const handY = drawY + Math.round(player.height / 2) + pose.offsetY;
  const image = props[pose.frame];
  context.save();
  context.translate(handX + player.facing * pose.offsetX, handY);
  context.scale(player.facing, 1);
  context.drawImage(image, -GRIP, -GRIP, image.width, image.height);
  if (pose.puffAge !== null) drawPuff(context, pose.puffAge);
  context.restore();
}
