import { SCREEN_HEIGHT, SCREEN_WIDTH } from './config.js';

// Largest whole-number scale that fits the free area, in device pixels, so every art pixel stays the same size.
// The insets are the safe-area margins in CSS pixels (notches, rounded corners).
// The logical size is the game screen unless another layout, such as the rotate prompt, is being fitted.
export function pickScale({
  width,
  height,
  devicePixelRatio,
  insets = { left: 0, right: 0, top: 0, bottom: 0 },
  logicalWidth = SCREEN_WIDTH,
  logicalHeight = SCREEN_HEIGHT,
}) {
  const freeWidth = width - insets.left - insets.right;
  const freeHeight = height - insets.top - insets.bottom;
  return Math.max(
    1,
    Math.floor(
      Math.min((freeWidth * devicePixelRatio) / logicalWidth, (freeHeight * devicePixelRatio) / logicalHeight),
    ),
  );
}

// Where the canvas goes: the scale, plus its CSS size and top left corner. Every edge lands on a whole
// device pixel, so a game pixel is never split across two screen pixels when the free area is centered.
export function fitScreen({ width, height, devicePixelRatio, insets = { left: 0, right: 0, top: 0, bottom: 0 } }) {
  const scale = pickScale({ width, height, devicePixelRatio, insets });
  const deviceWidth = SCREEN_WIDTH * scale;
  const deviceHeight = SCREEN_HEIGHT * scale;
  const freeDeviceWidth = (width - insets.left - insets.right) * devicePixelRatio;
  const freeDeviceHeight = (height - insets.top - insets.bottom) * devicePixelRatio;
  const deviceLeft = Math.round(insets.left * devicePixelRatio + Math.max(0, freeDeviceWidth - deviceWidth) / 2);
  const deviceTop = Math.round(insets.top * devicePixelRatio + Math.max(0, freeDeviceHeight - deviceHeight) / 2);
  return {
    scale,
    deviceWidth,
    deviceHeight,
    cssWidth: deviceWidth / devicePixelRatio,
    cssHeight: deviceHeight / devicePixelRatio,
    cssLeft: deviceLeft / devicePixelRatio,
    cssTop: deviceTop / devicePixelRatio,
  };
}

// A touch screen held upright shows the rotate prompt; a desktop window never does, however tall it is.
export function isPortraitOnTouchDevice({ width, height, hasCoarsePointer }) {
  return hasCoarsePointer && height > width;
}
