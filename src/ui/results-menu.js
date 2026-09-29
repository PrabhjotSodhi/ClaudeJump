import { SCREEN_WIDTH } from '../engine/config.js';
import { drawMenuOptions } from './menu-options.js';
import { drawText, measureText } from './text.js';

const OPTIONS_TOP_Y = 196;
const OPTIONS_TEXT_SCALE = 4;
const HINT_Y = 312;
const SELECTED_OPTION_COLOR = '#feae34';

export function drawResultsMenu(context, { options, selectedIndex }) {
  const widestLabelWidth = Math.max(...options.map((option) => measureText(option.label))) * OPTIONS_TEXT_SCALE;
  drawMenuOptions(context, {
    options,
    selectedIndex,
    topY: OPTIONS_TOP_Y,
    leftX: Math.floor((SCREEN_WIDTH - widestLabelWidth) / 2),
    selectedColor: SELECTED_OPTION_COLOR,
  });

  drawText(context, 'Enter or jump to select', SCREEN_WIDTH / 2, HINT_Y, { align: 'center' });
}
