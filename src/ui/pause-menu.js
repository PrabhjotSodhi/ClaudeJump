import { SCREEN_HEIGHT } from '../engine/config.js';
import {
  drawKeyHints,
  drawMenuList,
  drawMenuTitle,
  KEYCAP_HEIGHT,
  menuPanelSize,
  menuRowRectangles,
  TITLE_HEIGHT,
} from './menu-kit.js';
import { drawMenuBackdrop } from './menu-options.js';

const TITLE_GAP = 14;
const HINT_GAP = 14;
const HINTS = [
  { keys: ['Enter', 'A'], label: 'Select' },
  { keys: ['Esc', 'Start'], label: 'Resume' },
];

function pauseLayout(options) {
  const panelHeight = menuPanelSize(options.map((option) => option.label)).height;
  const stackHeight = TITLE_HEIGHT + TITLE_GAP + panelHeight + HINT_GAP + KEYCAP_HEIGHT;
  const titleY = Math.floor((SCREEN_HEIGHT - stackHeight) / 2);
  return { titleY, menuTopY: titleY + TITLE_HEIGHT + TITLE_GAP };
}

export function pauseMenuRowRectangles(options) {
  return menuRowRectangles(
    options.map((option) => option.label),
    pauseLayout(options).menuTopY,
  );
}

export function drawPauseMenu(context, { options, selectedIndex }) {
  drawMenuBackdrop(context);

  const { titleY, menuTopY } = pauseLayout(options);

  drawMenuTitle(context, 'Paused', titleY);
  const panelBottomY = drawMenuList(context, { options, selectedIndex, topY: menuTopY });
  drawKeyHints(context, HINTS, panelBottomY + HINT_GAP);
}
