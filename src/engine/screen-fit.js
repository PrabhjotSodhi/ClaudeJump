import { SCREEN_HEIGHT, SCREEN_WIDTH } from './config.js';

// Largest whole-number scale that fits the free area, in device pixels, so every art pixel stays the same size.
// The insets are the safe-area margins in CSS pixels (notches, rounded corners).
export function pickScale({ width, height, devicePixelRatio, insets = { left: 0, right: 0, top: 0, bottom: 0 } }) {
  const freeWidth = width - insets.left - insets.right;
  const freeHeight = height - insets.top - insets.bottom;
  return Math.max(
    1,
    Math.floor(
      Math.min((freeWidth * devicePixelRatio) / SCREEN_WIDTH, (freeHeight * devicePixelRatio) / SCREEN_HEIGHT),
    ),
  );
}

// A touch screen held upright shows the rotate prompt; a desktop window never does, however tall it is.
export function isPortraitOnTouchDevice({ width, height, hasCoarsePointer }) {
  return hasCoarsePointer && height > width;
}
