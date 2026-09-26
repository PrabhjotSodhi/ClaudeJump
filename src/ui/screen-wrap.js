import { SCREEN_WIDTH } from '../engine/config.js';

// Draws a second time offset by a screen width while the player is crossing an edge, the same
// way Player.render draws the player itself, so anything riding along with them never lags
// behind or leaves a gap.
export function drawFollowingWrap(context, player, x, y, draw) {
  draw(context, x, y);
  if (player.x < 0) draw(context, x + SCREEN_WIDTH, y);
  else if (player.x + player.width > SCREEN_WIDTH) draw(context, x - SCREEN_WIDTH, y);
}
