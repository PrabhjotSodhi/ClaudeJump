import { CARD_ICON_HEIGHT, CARD_ICON_WIDTH, drawCardIcon } from './card-icons.js';
import { HeldCardFlashTracker } from './held-card-flash.js';
import { drawFollowingWrap } from './screen-wrap.js';

// Gap between the icon and the player's head, leaving room above the icon for the color tag.
const ICON_GAP_ABOVE_HEAD = 6;
// One small square per use left, in a row centered under the icon on a backing bar in the player's color.
const PIP_SIZE = 2;
const PIP_SPACING = 3;
const PIP_GAP_BELOW_ICON = 3;

function drawUsePips(context, usesRemaining, iconX, iconY, color) {
  const rowWidth = usesRemaining * PIP_SPACING - (PIP_SPACING - PIP_SIZE);
  const rowX = iconX + Math.floor((CARD_ICON_WIDTH - rowWidth) / 2);
  const rowY = iconY + CARD_ICON_HEIGHT + PIP_GAP_BELOW_ICON;
  context.fillStyle = color;
  context.fillRect(rowX - 1, rowY - 1, rowWidth + 2, PIP_SIZE + 2);
  context.fillStyle = '#fff';
  for (let pip = 0; pip < usesRemaining; pip++) context.fillRect(rowX + pip * PIP_SPACING, rowY, PIP_SIZE, PIP_SIZE);
}

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

// The top of the icon slot above a player's head, fixed whether or not a card is held, so
// anything anchored to it (like the player tag) never jumps when a card is picked up or played.
export function heldCardIconSlotY(player) {
  return Math.round(player.y) - CARD_ICON_HEIGHT - ICON_GAP_ABOVE_HEAD;
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
    const y = heldCardIconSlotY(player);
    const flashing = !player.heldCardName && Boolean(flashedCardName);
    drawFollowingWrap(context, player, x, y, (context, x, y) => {
      drawCardIcon(context, cardName, x, y, player.color, { flashing });
      if (!flashing) drawUsePips(context, player.heldCardUsesRemaining, x, y, player.color);
    });
  }
}
