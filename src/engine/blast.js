import { HITSTOP_TICKS } from './config.js';

// How far a rocket or bomb blast reaches, and how hard it knocks players inside that range.
const BLAST_RADIUS = 48;
const BLAST_KNOCKBACK_VELOCITY_X = 8;
const BLAST_KNOCKBACK_VELOCITY_Y = -4;
export const BLAST_STRENGTH = 'heavy';

function playersInBlast(players, blastCenterX, blastCenterY) {
  return players.filter((player) => {
    if (player.inWater) return false;
    const distanceX = player.x + player.width / 2 - blastCenterX;
    const distanceY = player.y + player.height / 2 - blastCenterY;
    return Math.sqrt(distanceX * distanceX + distanceY * distanceY) <= BLAST_RADIUS;
  });
}

// Call every tick for a rocket or bomb that has hit something. The first call freezes the projectile, the
// shooter and every player in reach. The blast goes off, and this returns true, once that freeze is over.
// A blast with nobody in reach goes off at once.
export function blastIsReady(projectile, players, shooterId) {
  if (projectile.hitstopTicksRemaining === null) {
    const centerX = projectile.x + projectile.width / 2;
    const centerY = projectile.y + projectile.height / 2;
    const hitPlayers = playersInBlast(players, centerX, centerY);
    if (hitPlayers.length === 0) return true;

    projectile.hitstopTicksRemaining = HITSTOP_TICKS[BLAST_STRENGTH];
    const shooter = players.find((player) => player.id === shooterId);
    for (const player of new Set(shooter ? [...hitPlayers, shooter] : hitPlayers)) player.freeze(BLAST_STRENGTH);
    return false;
  }
  projectile.hitstopTicksRemaining--;
  return projectile.hitstopTicksRemaining === 0;
}

// Knocks back every player inside the blast radius that are not in the water and returns their ids.
export function knockBackPlayersInBlast(players, blastCenterX, blastCenterY) {
  const knockedPlayers = playersInBlast(players, blastCenterX, blastCenterY);
  for (const player of knockedPlayers) {
    const distanceX = player.x + player.width / 2 - blastCenterX;
    const distanceY = player.y + player.height / 2 - blastCenterY;
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    const knockbackDirectionX = distance === 0 ? 1 : distanceX / distance;
    const knockback = player.takeKnockbackHit(
      knockbackDirectionX * BLAST_KNOCKBACK_VELOCITY_X,
      BLAST_KNOCKBACK_VELOCITY_Y,
    );
    player.applyKnockback(knockback.x, knockback.y);
  }
  return knockedPlayers.map((player) => player.id);
}

// True when any part of the rectangle is inside the blast radius.
export function blastReaches(rectangle, blastCenterX, blastCenterY) {
  const nearestX = Math.max(rectangle.x, Math.min(blastCenterX, rectangle.x + rectangle.width));
  const nearestY = Math.max(rectangle.y, Math.min(blastCenterY, rectangle.y + rectangle.height));
  const distanceX = nearestX - blastCenterX;
  const distanceY = nearestY - blastCenterY;
  return Math.sqrt(distanceX * distanceX + distanceY * distanceY) <= BLAST_RADIUS;
}
