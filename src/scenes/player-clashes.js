import {
  SHOVE_CLASH_BOUNCE_VELOCITY_X,
  SHOVE_CLASH_CHARGE_MARGIN,
  SHOVE_CLASH_WIN_KNOCKBACK_MULTIPLIER,
} from '../engine/config.js';
import { knockBackShoveTarget } from '../entities/shove.js';

// How far one player's feet may sit above the other's head and still count as jumping over, not landing on them.
const DASH_HEAD_CLEARANCE = 8;
// Players knocked apart to a gap this small still count as the same contact, so the hit does not refire every tick.
const DASH_CONTACT_GAP = 6;
const DASH_KNOCKBACK_VELOCITY_X = 8;

// Resolves every pair in a fixed order, once per pair of shoves.
export function resolveShoveClashes(scene) {
  const players = scene.players;
  for (let firstIndex = 0; firstIndex < players.length; firstIndex++) {
    for (let secondIndex = firstIndex + 1; secondIndex < players.length; secondIndex++) {
      resolveShoveClash(scene, players[firstIndex], players[secondIndex]);
    }
  }
}

// Shoves clash when the players face each other, one shove is active and the other is winding up or just fired, and
// a hit zone reaches the other body. The stronger charge wins with reduced knockback. Otherwise neither lands and
// both players bounce apart, which also cancels a shove still winding up.
function resolveShoveClash(scene, playerA, playerB) {
  const pairId = [playerA.id, playerB.id].sort().join('-');
  const leftPlayer = playerA.x <= playerB.x ? playerA : playerB;
  const rightPlayer = leftPlayer === playerA ? playerB : playerA;
  const shovesAreClashing =
    (leftPlayer.isShoveActive || rightPlayer.isShoveActive) &&
    leftPlayer.isShoveClashable &&
    rightPlayer.isShoveClashable &&
    !leftPlayer.inWater &&
    !rightPlayer.inWater &&
    leftPlayer.facing > 0 &&
    rightPlayer.facing < 0 &&
    (rightPlayer.overlaps(leftPlayer.shoveHitZone) || leftPlayer.overlaps(rightPlayer.shoveHitZone));
  if (!shovesAreClashing) {
    scene.shoveClashPairIds.delete(pairId);
    return;
  }
  if (scene.shoveClashPairIds.has(pairId)) return;

  scene.shoveClashPairIds.add(pairId);
  for (const [shover, opponent] of [
    [playerA, playerB],
    [playerB, playerA],
  ]) {
    if (shover.isShoveActive) scene.shoveHitIdsByShoverId.get(shover.id).add(opponent.id);
  }
  const chargeLead = playerA.shoveClashCharge - playerB.shoveClashCharge;
  if (Math.abs(chargeLead) >= SHOVE_CLASH_CHARGE_MARGIN) {
    const winner = chargeLead > 0 ? playerA : playerB;
    knockBackShoveTarget({
      events: scene.events,
      shover: winner,
      opponent: winner === playerA ? playerB : playerA,
      knockbackScale: SHOVE_CLASH_WIN_KNOCKBACK_MULTIPLIER,
    });
  } else {
    leftPlayer.freeze('light', -SHOVE_CLASH_BOUNCE_VELOCITY_X, 0);
    rightPlayer.freeze('light', SHOVE_CLASH_BOUNCE_VELOCITY_X, 0);
  }
  const centerX = (leftPlayer.x + leftPlayer.width / 2 + rightPlayer.x + rightPlayer.width / 2) / 2;
  const centerY = (leftPlayer.y + leftPlayer.height / 2 + rightPlayer.y + rightPlayer.height / 2) / 2;
  scene.events.emit('shove-clash', { x: centerX, y: centerY, playerIds: [playerA.id, playerB.id] });
}

// Resolves every pair in a fixed order so the outcome never depends on iteration order.
export function resolvePlayerCollisions(scene) {
  const players = scene.players;
  for (let firstIndex = 0; firstIndex < players.length; firstIndex++) {
    for (let secondIndex = firstIndex + 1; secondIndex < players.length; secondIndex++) {
      resolvePlayerPair(scene, players[firstIndex], players[secondIndex]);
    }
  }
}

// Players pass through each other. Only a dash hurts: it knocks both players apart once per contact.
function resolvePlayerPair(scene, playerA, playerB) {
  const pairId = [playerA.id, playerB.id].sort().join('-');
  const isDashing = playerA.dashTicksRemaining > 0 || playerB.dashTicksRemaining > 0;
  if (playerA.inWater || playerB.inWater || !isDashing) {
    scene.dashHitPairIds.delete(pairId);
    return;
  }

  if (playersAreTouching(playerA, playerB, 0)) {
    const leftPlayer = playerA.x <= playerB.x ? playerA : playerB;
    const rightPlayer = leftPlayer === playerA ? playerB : playerA;
    if (!scene.dashHitPairIds.has(pairId)) {
      scene.dashHitPairIds.add(pairId);
      leftPlayer.freeze('medium', -DASH_KNOCKBACK_VELOCITY_X, 0);
      rightPlayer.freeze('medium', DASH_KNOCKBACK_VELOCITY_X, 0);
      const dasher = playerA.dashTicksRemaining > 0 ? playerA : playerB;
      scene.events.emit('dash-hit', {
        playerIds: [playerA.id, playerB.id],
        directionX: dasher.facing,
        directionY: 0,
        strength: 'medium',
      });
    }
  }

  if (!playersAreTouching(playerA, playerB, DASH_CONTACT_GAP)) scene.dashHitPairIds.delete(pairId);
}

// A player whose feet are clearly above the other's head is jumping over them, not touching them.
// horizontalPadding widens the gap that still counts as touching, so a hit kept apart by a few pixels
// is still the same contact instead of a fresh one.
function playersAreTouching(playerA, playerB, horizontalPadding) {
  const higherPlayer = playerA.y < playerB.y ? playerA : playerB;
  const lowerPlayer = higherPlayer === playerA ? playerB : playerA;
  if (higherPlayer.y + higherPlayer.height <= lowerPlayer.y + DASH_HEAD_CLEARANCE) return false;

  const leftPlayer = playerA.x <= playerB.x ? playerA : playerB;
  const rightPlayer = leftPlayer === playerA ? playerB : playerA;
  return leftPlayer.x + leftPlayer.width + horizontalPadding > rightPlayer.x;
}
