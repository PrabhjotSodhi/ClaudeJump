import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { drawText } from './text.js';

const BACKDROP_COLOR = 'rgba(20, 20, 40, 0.7)';
const DEFAULT_OPTION_SCALE = 4;
const GLYPH_ROWS = 5;
const ROW_GAP = 8;
const MARKER_GAP_PER_SCALE = 5;
const MARKER_HEIGHT_PER_SCALE = 4.5;

export function drawMenuBackdrop(context) {
  context.fillStyle = BACKDROP_COLOR;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
}

// A crisp right-pointing triangle beside the selected option, built from whole pixels.
function drawSelectionMarker(context, markerX, textTopY, markerHeight, color) {
  context.fillStyle = color;
  for (let row = 0; row < markerHeight; row++) {
    const distanceFromCenter = Math.abs(row - (markerHeight - 1) / 2);
    const width = Math.ceil(markerHeight / 2 - distanceFromCenter);
    context.fillRect(markerX, textTopY + row, width, 1);
  }
}

export function drawMenuOptions(
  context,
  { options, selectedIndex, topY, leftX, selectedColor, scale = DEFAULT_OPTION_SCALE },
) {
  options.forEach((option, index) => {
    const y = topY + index * (GLYPH_ROWS * scale + ROW_GAP);
    const isSelected = index === selectedIndex;
    drawText(context, option.label, leftX, y, { scale, color: isSelected ? selectedColor : '#fff' });
    if (isSelected)
      drawSelectionMarker(
        context,
        leftX - scale * MARKER_GAP_PER_SCALE,
        y,
        Math.round(scale * MARKER_HEIGHT_PER_SCALE),
        selectedColor,
      );
  });
}
