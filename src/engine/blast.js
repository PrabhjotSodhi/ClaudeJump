// How far a rocket or bomb blast reaches, and how hard it knocks players inside that range.
const BLAST_RADIUS = 48;
const BLAST_KNOCKBACK_VELOCITY_X = 8;
const BLAST_KNOCKBACK_VELOCITY_Y = -4;

// Knocks back every player inside the blast radius that are not in the water and returns their ids.
export function knockBackPlayersInBlast(players, blastCenterX, blastCenterY) {
  const knockedPlayerIds = [];
  for (const player of players) {
    if (player.inWater) continue;
    const distanceX = player.x + player.width / 2 - blastCenterX;
    const distanceY = player.y + player.height / 2 - blastCenterY;
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    if (distance > BLAST_RADIUS) continue;

    const knockbackDirectionX = distance === 0 ? 1 : distanceX / distance;
    player.applyKnockback(knockbackDirectionX * BLAST_KNOCKBACK_VELOCITY_X, BLAST_KNOCKBACK_VELOCITY_Y);
    knockedPlayerIds.push(player.id);
  }
  return knockedPlayerIds;
}
