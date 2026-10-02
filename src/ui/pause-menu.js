import { SCREEN_HEIGHT } from '../engine/config.js';
import {
  BACK_HINT,
  drawKeyHints,
  drawMenuList,
  drawMenuTitle,
  drawWithMenuMotion,
  KEYCAP_HEIGHT,
  menuListHeight,
  MOVE_HINT,
  SELECT_HINT,
  TITLE_HEIGHT,
} from './menu-kit.js';
import { drawMenuBackdrop } from './menu-options.js';

const TITLE_GAP = 14;
const HINT_GAP = 14;
const HINTS = [MOVE_HINT, SELECT_HINT, { ...BACK_HINT, label: 'Resume' }];

function pauseLayout(options) {
  const panelHeight = menuListHeight(options.length);
  const stackHeight = TITLE_HEIGHT + TITLE_GAP + panelHeight + HINT_GAP + KEYCAP_HEIGHT;
  const titleY = Math.floor((SCREEN_HEIGHT - stackHeight) / 2);
  return { titleY, menuTopY: titleY + TITLE_HEIGHT + TITLE_GAP };
}

export function drawPauseMenu(context, { options, selectedIndex, motion }) {
  drawMenuBackdrop(context);

  const { titleY, menuTopY } = pauseLayout(options);

  drawWithMenuMotion(context, motion, () => {
    drawMenuTitle(context, 'Paused', titleY);
    const panelBottomY = drawMenuList(context, { options, selectedIndex, topY: menuTopY, motion });
    drawKeyHints(context, HINTS, panelBottomY + HINT_GAP);
  });
}
