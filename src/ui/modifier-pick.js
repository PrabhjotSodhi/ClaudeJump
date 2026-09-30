import { ROUND_MODIFIERS, SCREEN_WIDTH } from '../engine/config.js';
import { drawModifierIcon, MODIFIER_ICON_SIZE } from './modifier-icons.js';
import { drawPanel } from './panel.js';
import { drawText, measureText } from './text.js';

const TITLE_Y = 96;
const OPTION_Y = 136;
const OPTION_WIDTH = 150;
const OPTION_HEIGHT = 44;
const OPTION_GAP = 16;
const ICON_SCALE = 2;
const OPTION_COLOR = '#8b9bb4';
const CHOSEN_COLOR = '#feae34';
const HINT_Y = 196;
const HINT_COLOR = '#c0cbdc';
const HINT_TEXT = 'Left or right to choose. Jump to confirm';
// The hint sits on its own panel so the arena behind never shows through the small text.
const HINT_PADDING_X = 8;
const HINT_PADDING_Y = 5;
const HINT_TEXT_HEIGHT = 5;

// The pick screen: who picks, the two options, and which one is highlighted.
export function drawModifierPick(context, scene) {
  if (scene.phase !== 'modifier') return;

  const picker = scene.players.find((player) => player.id === scene.modifierPickerId);
  drawText(context, `${picker.character.displayName} picks`, SCREEN_WIDTH / 2, TITLE_Y, { scale: 3, align: 'center' });
  const left = (SCREEN_WIDTH - 2 * OPTION_WIDTH - OPTION_GAP) / 2;
  scene.modifierOptionIds.forEach((modifierId, index) => {
    const x = left + index * (OPTION_WIDTH + OPTION_GAP);
    const chosen = index === scene.modifierHighlight;
    drawPanel(context, x, OPTION_Y, OPTION_WIDTH, OPTION_HEIGHT);
    if (chosen) {
      context.fillStyle = CHOSEN_COLOR;
      context.fillRect(x + 2, OPTION_Y, OPTION_WIDTH - 4, 2);
      context.fillRect(x + 2, OPTION_Y + OPTION_HEIGHT - 2, OPTION_WIDTH - 4, 2);
      context.fillRect(x, OPTION_Y + 2, 2, OPTION_HEIGHT - 4);
      context.fillRect(x + OPTION_WIDTH - 2, OPTION_Y + 2, 2, OPTION_HEIGHT - 4);
    }
    const iconSize = MODIFIER_ICON_SIZE * ICON_SCALE;
    drawModifierIcon(context, modifierId, x + 12, OPTION_Y + (OPTION_HEIGHT - iconSize) / 2, ICON_SCALE);
    drawText(context, ROUND_MODIFIERS[modifierId].name, x + 12 + iconSize + 8, OPTION_Y + OPTION_HEIGHT / 2 - 5, {
      scale: 1,
      color: chosen ? CHOSEN_COLOR : OPTION_COLOR,
      outlineColor: null,
    });
  });
  const hintWidth = measureText(HINT_TEXT) + 2 * HINT_PADDING_X;
  drawPanel(
    context,
    Math.floor((SCREEN_WIDTH - hintWidth) / 2),
    HINT_Y - HINT_PADDING_Y,
    hintWidth,
    HINT_TEXT_HEIGHT + 2 * HINT_PADDING_Y,
  );
  drawText(context, HINT_TEXT, SCREEN_WIDTH / 2, HINT_Y, {
    scale: 1,
    align: 'center',
    color: HINT_COLOR,
    outlineColor: null,
  });
}
