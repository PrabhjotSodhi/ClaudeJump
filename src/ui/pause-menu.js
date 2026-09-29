import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { drawMenuOptions } from './menu-options.js';
import { drawText } from './text.js';

const BACKDROP_COLOR = 'rgba(20, 20, 40, 0.7)';
const TITLE_Y = 124;
const TITLE_SCALE = 4;
const OPTIONS_TOP_Y = 184;
const OPTIONS_LEFT_X = 290;
const HINT_Y = 260;
const SELECTED_OPTION_COLOR = '#ffdc28';

export function drawPauseMenu(context, { options, selectedIndex }) {
  context.fillStyle = BACKDROP_COLOR;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  drawText(context, 'Paused', SCREEN_WIDTH / 2, TITLE_Y, { scale: TITLE_SCALE, align: 'center' });

  drawMenuOptions(context, {
    options,
    selectedIndex,
    topY: OPTIONS_TOP_Y,
    leftX: OPTIONS_LEFT_X,
    selectedColor: SELECTED_OPTION_COLOR,
  });

  drawText(context, 'Enter to select', SCREEN_WIDTH / 2, HINT_Y, { align: 'center' });
}
