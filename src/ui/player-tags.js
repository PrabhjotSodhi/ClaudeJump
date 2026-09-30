import { CARD_ICON_OUTLINE_MARGIN } from './card-icons.js';
import { heldCardIconSlotY } from './held-card-icons.js';
import { drawFollowingWrap } from './screen-wrap.js';
import { drawText, TEXT_GLYPH_HEIGHT, TEXT_OUTLINE_MARGIN } from './text.js';

// Gap left between the tag's outlined bottom and the icon's outlined top, so the tag sits at a
// fixed spot whether or not a card is held and never jumps when one is picked up or played.
const GAP_ABOVE_ICON = 4;
// How far the tag's outlined top may be pinned down from the very top of the screen, so a player
// launched off the top edge by a bounce pad or a double jump still shows a findable tag.
const TOP_EDGE_MARGIN = 2;

const TAG_LABEL_BY_PLAYER_ID = { red: 'P1', blue: 'P2', green: 'P3', yellow: 'P4' };

// Pure so the pinning behavior can be tested without a canvas.
export function playerTagPosition(player) {
  const x = Math.round(player.x + player.width / 2);
  const iconOutlinedTopY = heldCardIconSlotY(player) - CARD_ICON_OUTLINE_MARGIN;
  const fittedY = iconOutlinedTopY - GAP_ABOVE_ICON - TEXT_GLYPH_HEIGHT - TEXT_OUTLINE_MARGIN;
  const y = Math.max(TOP_EDGE_MARGIN + TEXT_OUTLINE_MARGIN, fittedY);
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
