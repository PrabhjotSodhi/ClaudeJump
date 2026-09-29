import { drawText } from './text.js';

const OPTION_ROW_HEIGHT = 28;
const OPTION_TEXT_SCALE = 4;
const SELECTION_MARKER_GAP = 20;
const SELECTION_MARKER_HEIGHT = 18;

// A crisp right-pointing triangle beside the selected option, built from whole pixels.
function drawSelectionMarker(context, markerX, textTopY, color) {
  context.fillStyle = color;
  const rowCount = SELECTION_MARKER_HEIGHT;
  for (let row = 0; row < rowCount; row++) {
    const distanceFromCenter = Math.abs(row - (rowCount - 1) / 2);
    const width = Math.ceil(rowCount / 2 - distanceFromCenter);
    context.fillRect(markerX, textTopY + row, width, 1);
  }
}

export function drawMenuOptions(context, { options, selectedIndex, topY, leftX, selectedColor }) {
  options.forEach((option, index) => {
    const y = topY + index * OPTION_ROW_HEIGHT;
    const isSelected = index === selectedIndex;
    drawText(context, option.label, leftX, y, {
      scale: OPTION_TEXT_SCALE,
      color: isSelected ? selectedColor : '#fff',
    });
    if (isSelected) drawSelectionMarker(context, leftX - SELECTION_MARKER_GAP, y, selectedColor);
  });
}
