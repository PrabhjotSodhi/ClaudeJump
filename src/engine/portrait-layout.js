import { SCREEN_HEIGHT, SCREEN_WIDTH } from './config.js';

// The controls panel is drawn on its own small canvas, scaled by a whole number of device pixels.
export const CONTROLS_PANEL_WIDTH = 160;
const CONTROLS_PANEL_MIN_HEIGHT = 64;
// Frame space in CSS pixels above the game and between the game and the panel.
const FRAME_MARGIN = 8;

// A phone held upright shows the game across the full width at the top and the controls panel
// directly under it, down to the bottom safe area. The game is scaled to the width with
// nearest-neighbour sampling, so some game pixels are one device pixel wider than others.
// Every edge lands on a whole device pixel. The insets are safe-area margins in CSS pixels.
export function fitPortraitLayout({
  width,
  height,
  devicePixelRatio,
  insets = { left: 0, right: 0, top: 0, bottom: 0 },
}) {
  const freeDeviceWidth = Math.floor((width - insets.left - insets.right) * devicePixelRatio);
  const insetDeviceLeft = Math.round(insets.left * devicePixelRatio);
  const marginDevicePixels = Math.round(FRAME_MARGIN * devicePixelRatio);

  const gameDeviceWidth = freeDeviceWidth;
  const gameDeviceHeight = Math.round((freeDeviceWidth * SCREEN_HEIGHT) / SCREEN_WIDTH);
  const gameDeviceTop = Math.round(insets.top * devicePixelRatio) + marginDevicePixels;

  const controlsScale = Math.max(1, Math.floor(freeDeviceWidth / CONTROLS_PANEL_WIDTH));
  const controlsDeviceTop = gameDeviceTop + gameDeviceHeight + marginDevicePixels;
  const controlsDeviceBottom = Math.round(height * devicePixelRatio) - Math.round(insets.bottom * devicePixelRatio);
  const controlsLogicalHeight = Math.max(
    CONTROLS_PANEL_MIN_HEIGHT,
    Math.floor((controlsDeviceBottom - controlsDeviceTop) / controlsScale),
  );
  const controlsDeviceWidth = CONTROLS_PANEL_WIDTH * controlsScale;
  const controlsDeviceHeight = controlsLogicalHeight * controlsScale;
  const controlsDeviceLeft = insetDeviceLeft + Math.floor((freeDeviceWidth - controlsDeviceWidth) / 2);

  return {
    game: {
      deviceWidth: gameDeviceWidth,
      deviceHeight: gameDeviceHeight,
      cssWidth: gameDeviceWidth / devicePixelRatio,
      cssHeight: gameDeviceHeight / devicePixelRatio,
      cssLeft: insetDeviceLeft / devicePixelRatio,
      cssTop: gameDeviceTop / devicePixelRatio,
    },
    controls: {
      scale: controlsScale,
      logicalWidth: CONTROLS_PANEL_WIDTH,
      logicalHeight: controlsLogicalHeight,
      cssWidth: controlsDeviceWidth / devicePixelRatio,
      cssHeight: controlsDeviceHeight / devicePixelRatio,
      cssLeft: controlsDeviceLeft / devicePixelRatio,
      cssTop: (controlsDeviceBottom - controlsDeviceHeight) / devicePixelRatio,
    },
  };
}
