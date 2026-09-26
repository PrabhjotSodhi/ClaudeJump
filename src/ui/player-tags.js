import { heldCardIconSlotY } from './held-card-icons.js';
import { drawFollowingWrap } from './screen-wrap.js';
import { drawText } from './text.js';

// Gap between the tag and the icon slot above it, so the tag sits at a fixed spot whether or
// not a card is held and never jumps when one is picked up or played.
const TAG_GAP_ABOVE_ICON_SLOT = 2;
// How far down from the very top of the screen a tag may be pinned, so a player launched off the
// top edge by a bounce pad or a double jump still shows a findable tag instead of none at all.
const TAG_TOP_EDGE_MARGIN = 1;

const TAG_LABEL_BY_PLAYER_ID = { red: 'P1', blue: 'P2' };

// Pure so the pinning behavior can be tested without a canvas.
export function playerTagPosition(player) {
  const x = Math.round(player.x + player.width / 2);
  const y = Math.max(TAG_TOP_EDGE_MARGIN, heldCardIconSlotY(player) - TAG_GAP_ABOVE_ICON_SLOT);
  return { x, y };
}

// Drawn last on the game layer so the tags float above everything else there, including the
// player sprites and held card icons.
export function drawPlayerTags(context, scene) {
  for (const player of scene.players) {
    const label = TAG_LABEL_BY_PLAYER_ID[player.id];
    if (!label) continue;

    const { x, y } = playerTagPosition(player);
    drawFollowingWrap(context, player, x, y, (context, x, y) =>
      drawText(context, label, x, y, { align: 'center', color: player.color }),
    );
  }
}
