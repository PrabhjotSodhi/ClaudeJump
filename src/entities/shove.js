import { SHOVE_KNOCKBACK_VELOCITY_X, SHOVE_KNOCKBACK_VELOCITY_Y } from './player.js';

export function knockBackShoveTarget({ events, shover, opponent, knockbackScale }) {
  const strength = shover.shoveCharge >= 1 ? 'medium' : 'light';
  const multiplier = shover.shoveKnockbackMultiplier * knockbackScale;
  opponent.freeze(
    strength,
    SHOVE_KNOCKBACK_VELOCITY_X * multiplier * shover.facing,
    SHOVE_KNOCKBACK_VELOCITY_Y * multiplier,
  );
  shover.freeze(strength);
  events.emit('player-shoved', {
    shoverId: shover.id,
    targetId: opponent.id,
    directionX: shover.facing,
    directionY: 0,
    strength,
    charge: shover.shoveCharge,
  });
}

// Every other player touching the shover's hit zone gets knocked away, once per shove. The pop
// upward lets air knockback decay carry the hit, so a shove near the edge can end a round.
// alreadyHitIds holds the opponents this shove has already hit.
export function resolveShoveHit({ events, players, shover, alreadyHitIds }) {
  const hitZone = shover.shoveHitZone;
  for (const opponent of players) {
    if (opponent.id === shover.id || opponent.inWater || alreadyHitIds.has(opponent.id)) continue;
    if (!opponent.overlaps(hitZone)) continue;

    alreadyHitIds.add(opponent.id);
    knockBackShoveTarget({ events, shover, opponent, knockbackScale: 1 });
  }
}
