import {
  KNOCKOUT_SLOWMO_TICKS,
  KNOCKOUT_ZOOM,
  KNOCKOUT_ZOOM_IN_TICKS,
  KNOCKOUT_ZOOM_OUT_TICKS,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
} from '../engine/config.js';

const CROP_WIDTH = SCREEN_WIDTH / KNOCKOUT_ZOOM;
const CROP_HEIGHT = SCREEN_HEIGHT / KNOCKOUT_ZOOM;
const CENTERED_ORIGIN_X = (SCREEN_WIDTH - CROP_WIDTH) / 2;
const CENTERED_ORIGIN_Y = (SCREEN_HEIGHT - CROP_HEIGHT) / 2;

function easeOut(progress) {
  return 1 - (1 - progress) * (1 - progress);
}

// How the view is cropped and enlarged for the knockout that decides a round. Render only: it reads the scene and
// never changes it. The factor is a whole number and the crop origin is a whole pixel, so every game pixel stays a
// crisp block of screen pixels.
export function knockoutZoom(scene) {
  const noZoom = { factor: 1, originX: 0, originY: 0 };
  if (scene.knockoutTicks === 0) return noZoom;

  const slideOutTicks = scene.knockoutTicks - KNOCKOUT_SLOWMO_TICKS;
  if (slideOutTicks >= KNOCKOUT_ZOOM_OUT_TICKS) return noZoom;
  const slide =
    slideOutTicks < 0
      ? Math.min(1, scene.knockoutTicks / KNOCKOUT_ZOOM_IN_TICKS)
      : 1 - slideOutTicks / KNOCKOUT_ZOOM_OUT_TICKS;

  const focusPlayer = scene.players.find((player) => player.id === scene.knockoutFocusPlayerId);
  if (!focusPlayer) return noZoom;
  const targetOriginX = Math.max(
    0,
    Math.min(SCREEN_WIDTH - CROP_WIDTH, Math.round(focusPlayer.x + focusPlayer.width / 2 - CROP_WIDTH / 2)),
  );
  const targetOriginY = Math.max(
    0,
    Math.min(SCREEN_HEIGHT - CROP_HEIGHT, Math.round(focusPlayer.y + focusPlayer.height / 2 - CROP_HEIGHT / 2)),
  );
  const eased = easeOut(slide);
  return {
    factor: KNOCKOUT_ZOOM,
    originX: Math.round(CENTERED_ORIGIN_X + (targetOriginX - CENTERED_ORIGIN_X) * eased),
    originY: Math.round(CENTERED_ORIGIN_Y + (targetOriginY - CENTERED_ORIGIN_Y) * eased),
  };
}
