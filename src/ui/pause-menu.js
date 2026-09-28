import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { drawText } from './text.js';

const BACKDROP_COLOR = 'rgba(20, 20, 40, 0.7)';
const TITLE_Y = 124;
const TITLE_SCALE = 4;
const OPTIONS_TOP_Y = 184;
const OPTION_ROW_HEIGHT = 28;
const OPTIONS_LEFT_X = 290;
const HINT_Y = 260;
const SELECTED_OPTION_COLOR = '#ffdc28';
const SELECTION_MARKER_X = OPTIONS_LEFT_X - 20;
const SELECTION_MARKER_HEIGHT = 18;

// A crisp right-pointing triangle beside the selected option, built from whole pixels.
function drawSelectionMarker(context, textTopY) {
  context.fillStyle = SELECTED_OPTION_COLOR;
  const rowCount = SELECTION_MARKER_HEIGHT;
  for (let row = 0; row < rowCount; row++) {
    const distanceFromCenter = Math.abs(row - (rowCount - 1) / 2);
    const width = Math.ceil(rowCount / 2 - distanceFromCenter);
    context.fillRect(SELECTION_MARKER_X, textTopY + row, width, 1);
  }
}

export function drawPauseMenu(context, { options, selectedIndex }) {
  context.fillStyle = BACKDROP_COLOR;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  drawText(context, 'Paused', SCREEN_WIDTH / 2, TITLE_Y, { scale: TITLE_SCALE, align: 'center' });

  options.forEach((option, index) => {
    const y = OPTIONS_TOP_Y + index * OPTION_ROW_HEIGHT;
    const isSelected = index === selectedIndex;
    drawText(context, option.label, OPTIONS_LEFT_X, y, {
      scale: 4,
      color: isSelected ? SELECTED_OPTION_COLOR : '#fff',
    });
    if (isSelected) drawSelectionMarker(context, y);
  });

  drawText(context, 'Enter to select', SCREEN_WIDTH / 2, HINT_Y, { align: 'center' });
}
