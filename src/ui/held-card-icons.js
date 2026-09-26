import { SCREEN_WIDTH } from '../engine/config.js';
import { CARD_ICON_HEIGHT, CARD_ICON_WIDTH, drawCardIcon } from './card-icons.js';
import { HeldCardFlashTracker } from './held-card-flash.js';

// Gap between the icon and the player's head, leaving room above the icon for issue #33's color tag.
const ICON_GAP_ABOVE_HEAD = 3;

const flashTrackersByScene = new WeakMap();

function heldCardFlashTracker(scene) {
  let tracker = flashTrackersByScene.get(scene);
  if (!tracker) {
    tracker = new HeldCardFlashTracker();
    scene.events.on('card-played', ({ playerId, cardName }) => tracker.notePlayed(playerId, cardName, scene.tickCount));
    flashTrackersByScene.set(scene, tracker);
  }
  return tracker;
}

// Drawn a second time offset by a screen width while the player is crossing an edge, the same
// way Player.render draws the player itself, so the icon never lags behind or leaves a gap.
function drawWrapped(context, player, cardName, x, y, flashing) {
  drawCardIcon(context, cardName, x, y, player.color, { flashing });
  if (player.x < 0) drawCardIcon(context, cardName, x + SCREEN_WIDTH, y, player.color, { flashing });
  else if (player.x + player.width > SCREEN_WIDTH)
    drawCardIcon(context, cardName, x - SCREEN_WIDTH, y, player.color, { flashing });
}

// Drawn on the game layer, right after the entities, so the icon rides along with the player
// (and its shake, once issue #31 adds it) instead of sitting still on the HUD layer above it.
export function drawHeldCardIcons(context, scene) {
  const tracker = heldCardFlashTracker(scene);
  for (const player of scene.players) {
    const flashedCardName = tracker.flashingCardName(player.id, scene.tickCount);
    const cardName = player.heldCardName ?? flashedCardName;
    if (!cardName) continue;

    const x = Math.round(player.x + player.width / 2 - CARD_ICON_WIDTH / 2);
    const y = Math.round(player.y) - CARD_ICON_HEIGHT - ICON_GAP_ABOVE_HEAD;
    const flashing = !player.heldCardName && Boolean(flashedCardName);
    drawWrapped(context, player, cardName, x, y, flashing);
  }
}
