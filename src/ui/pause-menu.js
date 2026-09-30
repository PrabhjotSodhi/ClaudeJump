import { SCREEN_HEIGHT } from '../engine/config.js';
import { drawKeyHints, drawMenuList, drawMenuTitle, KEYCAP_HEIGHT, menuPanelSize, TITLE_HEIGHT } from './menu-kit.js';
import { drawMenuBackdrop } from './menu-options.js';

const TITLE_GAP = 14;
const HINT_GAP = 14;
const HINTS = [
  { keys: ['Enter', 'A'], label: 'Select' },
  { keys: ['Esc', 'Start'], label: 'Resume' },
];

export function drawPauseMenu(context, { options, selectedIndex }) {
  drawMenuBackdrop(context);

  const panelHeight = menuPanelSize(options.map((option) => option.label)).height;
  const stackHeight = TITLE_HEIGHT + TITLE_GAP + panelHeight + HINT_GAP + KEYCAP_HEIGHT;
  const titleY = Math.floor((SCREEN_HEIGHT - stackHeight) / 2);

  drawMenuTitle(context, 'Paused', titleY);
  const panelBottomY = drawMenuList(context, { options, selectedIndex, topY: titleY + TITLE_HEIGHT + TITLE_GAP });
  drawKeyHints(context, HINTS, panelBottomY + HINT_GAP);
}
