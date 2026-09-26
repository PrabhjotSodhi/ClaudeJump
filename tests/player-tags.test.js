import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CARD_ICON_OUTLINE_MARGIN } from '../src/ui/card-icons.js';
import { heldCardIconSlotY } from '../src/ui/held-card-icons.js';
import { playerTagPosition } from '../src/ui/player-tags.js';
import { TEXT_GLYPH_HEIGHT, TEXT_OUTLINE_MARGIN } from '../src/ui/text.js';

test('the tag sits a fixed distance above the icon slot regardless of x', () => {
  const lowPosition = playerTagPosition({ x: 100, y: 120, width: 16 });
  const highPosition = playerTagPosition({ x: 200, y: 20, width: 16 });

  assert.equal(lowPosition.x, 108);
  assert.ok(lowPosition.y < 120, 'tag is drawn above the player, not below');
  assert.ok(highPosition.y < lowPosition.y, 'a higher player gets a higher tag');
});

test('the tag is pinned to the top edge once the player is launched above it', () => {
  const onScreenPosition = playerTagPosition({ x: 100, y: 50, width: 16 });
  const offScreenPosition = playerTagPosition({ x: 100, y: -40, width: 16 });

  assert.ok(offScreenPosition.y >= 1, 'pinned tag never leaves the top edge of the screen');
  assert.ok(offScreenPosition.y < onScreenPosition.y, 'pinning still keeps it visibly higher than an on-screen player');
});

test("the tag's outlined bottom never overlaps the icon slot's outlined top", () => {
  const player = { x: 100, y: 120, width: 16 };
  const { y } = playerTagPosition(player);

  const tagOutlinedBottom = y + TEXT_GLYPH_HEIGHT + TEXT_OUTLINE_MARGIN;
  const iconOutlinedTop = heldCardIconSlotY(player) - CARD_ICON_OUTLINE_MARGIN;

  assert.ok(
    tagOutlinedBottom < iconOutlinedTop,
    `tag bottom ${tagOutlinedBottom} must sit above icon top ${iconOutlinedTop}`,
  );
});

test('a pinned tag still follows the player horizontally', () => {
  const leftPosition = playerTagPosition({ x: -1000, y: 5, width: 16 });
  const rightPosition = playerTagPosition({ x: 1000, y: 5, width: 16 });

  assert.equal(leftPosition.y, rightPosition.y, 'both are pinned to the same top edge');
  assert.notEqual(leftPosition.x, rightPosition.x, 'x keeps tracking the player even while pinned');
});
