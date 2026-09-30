import { SCREEN_WIDTH } from '../engine/config.js';

// Returns the first platform a crate box lands on when its bottom edge is at `bottom`, or undefined.
// The screen wraps, so a box crossing an edge also counts as standing at the far side.
// A pure function of its inputs, shared by the crate's fall and its landing prediction.
export function findLandingPlatform({ x, width, bottom, platforms }) {
  return platforms.find((platform) => {
    if (bottom < platform.y) return false;
    return [-SCREEN_WIDTH, 0, SCREEN_WIDTH].some(
      (offset) => x + offset + width > platform.x && x + offset < platform.x + platform.width,
    );
  });
}

// Where a crate at (x, y) falling `fallSpeed` pixels per tick comes to rest: { x, y, ticks } with the
// crate's top left corner and the ticks it still has to fall, or null when it reaches `fallLimitY`
// without meeting a platform. Pure game state, so every online device predicts the same spot.
export function predictCrateLanding({ x, y, width, height, fallSpeed, platforms, fallLimitY }) {
  let ticks = 0;
  for (let fallenY = y; fallenY < fallLimitY;) {
    fallenY += fallSpeed;
    ticks++;
    const platform = findLandingPlatform({ x, width, bottom: fallenY + height, platforms });
    if (platform) return { x, y: platform.y - height, ticks };
  }
  return null;
}
