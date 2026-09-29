import { SCREEN_WIDTH } from './config.js';

// Only snaps once the entity has fully left the screen; its render draws the crossing itself.
// Returns whether it wrapped.
export function wrapAroundScreen(entity) {
  if (entity.x + entity.width < 0) entity.x += SCREEN_WIDTH;
  else if (entity.x > SCREEN_WIDTH) entity.x -= SCREEN_WIDTH;
  else return false;
  return true;
}
