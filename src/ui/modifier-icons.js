export const MODIFIER_ICON_SIZE = 12;

const OUTLINE_COLOR = '#181425';
const FEATHER_COLOR = '#c0cbdc';
const ICE_COLOR = '#8fd3ff';
const PEEL_COLOR = '#f0d028';
const TIP_COLOR = '#6a4a20';
const CRATE_COLOR = '#a0703c';
const CRATE_BAND_COLOR = '#5c3c1e';
const SPEED_COLOR = '#feae34';

// A picture for each modifier in ROUND_MODIFIERS, drawn on a 12x12 grid. Each drawer calls fill(color, x, y, width, height).
const ICON_DRAWERS = {
  lowGravity(fill) {
    fill(FEATHER_COLOR, 5, 1, 2, 10);
    fill(FEATHER_COLOR, 3, 3, 6, 2);
    fill(FEATHER_COLOR, 1, 5, 10, 2);
  },
  slipperyFloors(fill) {
    fill(ICE_COLOR, 0, 2, 8, 2);
    fill(ICE_COLOR, 3, 5, 9, 2);
    fill(ICE_COLOR, 1, 8, 8, 2);
  },
  bananaRain(fill) {
    fill(PEEL_COLOR, 1, 5, 10, 4);
    fill(PEEL_COLOR, 3, 3, 6, 2);
    fill(TIP_COLOR, 1, 3, 2, 2);
    fill(TIP_COLOR, 9, 3, 2, 2);
  },
  fastCrates(fill) {
    fill(CRATE_COLOR, 3, 2, 8, 8);
    fill(CRATE_BAND_COLOR, 3, 5, 8, 2);
    fill(SPEED_COLOR, 0, 3, 2, 1);
    fill(SPEED_COLOR, 0, 8, 2, 1);
  },
};

// Draws the icon with its top left at (x, y), each of its pixels `scale` pixels wide.
export function drawModifierIcon(context, modifierId, x, y, scale = 1) {
  const fill = (color, offsetX, offsetY, width, height) => {
    context.fillStyle = color;
    context.fillRect(x + offsetX * scale, y + offsetY * scale, width * scale, height * scale);
  };
  fill(OUTLINE_COLOR, 0, 0, MODIFIER_ICON_SIZE, MODIFIER_ICON_SIZE);
  ICON_DRAWERS[modifierId](fill);
}
