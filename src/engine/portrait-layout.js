import { SCREEN_HEIGHT, SCREEN_WIDTH } from './config.js';

// A phone held upright shows the game across the top and a controls panel below it.
// 'full' fills the width, so some game pixels are one device pixel wider than others.
// 'crisp' keeps every game pixel the same size, which leaves the game narrower than the phone.
// The controls panel is drawn on its own small canvas, scaled by a whole number of device pixels.
export const CONTROLS_PANEL_WIDTH = 160;
const CONTROLS_PANEL_MIN_HEIGHT = 64;
const CONTROLS_PANEL_MAX_HEIGHT = 160;
// Frame space in CSS pixels above the game and between the game and the panel.
const FRAME_MARGIN = 8;

// Every edge lands on a whole device pixel. The insets are safe-area margins in CSS pixels.
export function fitPortraitLayout({
  width,
  height,
  devicePixelRatio,
  insets = { left: 0, right: 0, top: 0, bottom: 0 },
  scaling = 'full',
}) {
  const freeDeviceWidth = Math.floor((width - insets.left - insets.right) * devicePixelRatio);
  const insetDeviceLeft = Math.round(insets.left * devicePixelRatio);
  const marginDevicePixels = Math.round(FRAME_MARGIN * devicePixelRatio);

  let gameDeviceWidth = freeDeviceWidth;
  let gameDeviceHeight = Math.round((freeDeviceWidth * SCREEN_HEIGHT) / SCREEN_WIDTH);
  if (scaling === 'crisp') {
    const gameScale = Math.max(1, Math.floor(freeDeviceWidth / SCREEN_WIDTH));
    gameDeviceWidth = SCREEN_WIDTH * gameScale;
    gameDeviceHeight = SCREEN_HEIGHT * gameScale;
  }
  const gameDeviceLeft = insetDeviceLeft + Math.floor((freeDeviceWidth - gameDeviceWidth) / 2);
  const gameDeviceTop = Math.round(insets.top * devicePixelRatio) + marginDevicePixels;

  const controlsScale = Math.max(1, Math.floor(freeDeviceWidth / CONTROLS_PANEL_WIDTH));
  const controlsDeviceTop = gameDeviceTop + gameDeviceHeight + marginDevicePixels;
  const controlsDeviceBottom =
    Math.round(height * devicePixelRatio) - Math.round(insets.bottom * devicePixelRatio) - marginDevicePixels;
  const controlsLogicalHeight = Math.min(
    CONTROLS_PANEL_MAX_HEIGHT,
    Math.max(CONTROLS_PANEL_MIN_HEIGHT, Math.floor((controlsDeviceBottom - controlsDeviceTop) / controlsScale)),
  );
  const controlsDeviceWidth = CONTROLS_PANEL_WIDTH * controlsScale;
  const controlsDeviceHeight = controlsLogicalHeight * controlsScale;
  const controlsDeviceLeft = insetDeviceLeft + Math.floor((freeDeviceWidth - controlsDeviceWidth) / 2);
  const controlsDeviceTopCentered =
    controlsDeviceTop + Math.max(0, Math.floor((controlsDeviceBottom - controlsDeviceTop - controlsDeviceHeight) / 2));

  return {
    scaling,
    game: {
      deviceWidth: gameDeviceWidth,
      deviceHeight: gameDeviceHeight,
      cssWidth: gameDeviceWidth / devicePixelRatio,
      cssHeight: gameDeviceHeight / devicePixelRatio,
      cssLeft: gameDeviceLeft / devicePixelRatio,
      cssTop: gameDeviceTop / devicePixelRatio,
    },
    controls: {
      scale: controlsScale,
      logicalWidth: CONTROLS_PANEL_WIDTH,
      logicalHeight: controlsLogicalHeight,
      cssWidth: controlsDeviceWidth / devicePixelRatio,
      cssHeight: controlsDeviceHeight / devicePixelRatio,
      cssLeft: controlsDeviceLeft / devicePixelRatio,
      cssTop: controlsDeviceTopCentered / devicePixelRatio,
    },
  };
}
