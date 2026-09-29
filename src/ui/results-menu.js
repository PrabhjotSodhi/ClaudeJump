import { SCREEN_WIDTH } from '../engine/config.js';
import { drawPhaseMessage } from './hud.js';
import { drawMenuBackdrop, drawMenuOptions } from './menu-options.js';
import { drawPanel } from './panel.js';
import { drawText, measureText } from './text.js';

const PANEL_WIDTH = 400;
const PANEL_TOP_Y = 102;
const PANEL_HEIGHT = 190;
const STATS_TOP_Y = 118;
const STATS_ROW_HEIGHT = 18;
const STATS_COLUMN_OFFSET_X = 120;
const OPTIONS_TOP_Y = 190;
const OPTIONS_TEXT_SCALE = 2;
const HINT_Y = 262;
const SELECTED_OPTION_COLOR = '#feae34';

function drawPlayerStats(context, matchScene) {
  matchScene.players.forEach((player, columnIndex) => {
    const x = SCREEN_WIDTH / 2 + (columnIndex === 0 ? -STATS_COLUMN_OFFSET_X : STATS_COLUMN_OFFSET_X);
    drawText(context, player.character.displayName, x, STATS_TOP_Y, { align: 'center', color: player.color });
    drawText(context, `Wins ${matchScene.wins[player.id]}`, x, STATS_TOP_Y + STATS_ROW_HEIGHT, { align: 'center' });
    drawText(context, `Falls ${matchScene.matchStats.fallsIn[player.id]}`, x, STATS_TOP_Y + 2 * STATS_ROW_HEIGHT, {
      align: 'center',
    });
  });
}

export function drawResultsMenu(context, { matchScene, options, selectedIndex }) {
  drawMenuBackdrop(context);
  drawPhaseMessage(context, matchScene);
  drawPanel(context, (SCREEN_WIDTH - PANEL_WIDTH) / 2, PANEL_TOP_Y, PANEL_WIDTH, PANEL_HEIGHT);
  drawPlayerStats(context, matchScene);

  const widestLabelWidth = Math.max(...options.map((option) => measureText(option.label))) * OPTIONS_TEXT_SCALE;
  drawMenuOptions(context, {
    options,
    selectedIndex,
    topY: OPTIONS_TOP_Y,
    leftX: Math.floor((SCREEN_WIDTH - widestLabelWidth) / 2),
    selectedColor: SELECTED_OPTION_COLOR,
    scale: OPTIONS_TEXT_SCALE,
  });

  drawText(context, 'Enter or jump to select', SCREEN_WIDTH / 2, HINT_Y, { align: 'center' });
}
