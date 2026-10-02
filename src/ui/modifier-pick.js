import { ROUND_MODIFIERS, SCREEN_WIDTH } from '../engine/config.js';
import { drawKeyHints, drawPointer } from './menu-kit.js';
import { drawModifierIcon, MODIFIER_ICON_SIZE } from './modifier-icons.js';
import { drawText, measureText } from './text.js';

const TITLE_Y = 96;
const OPTION_Y = 136;
const OPTION_WIDTH = 180;
const OPTION_GAP = 16;
const ICON_SCALE = 2;
const ICON_GAP = 8;
const POINTER_GAP = 6;
const GLYPH_HEIGHT = 5;
const OPTION_COLOR = '#8b9bb4';
const CHOSEN_COLOR = '#feae34';
const OUTLINE_COLOR = '#3e2731';
const HINT_Y = 196;

function hintsFor(playerId) {
  return [
    {
      keys: [
        { player: playerId, control: 'left' },
        { player: playerId, control: 'right' },
      ],
      pad: ['stick'],
      label: 'Move',
    },
    { keys: [{ player: playerId, control: 'jump' }], pad: ['south'], label: 'Select' },
  ];
}

// The pick screen: who picks, and the two options side by side as an icon and outlined text on the arena. The
// highlighted one is bigger, in the selected color, with a pointer.
export function drawModifierPick(context, scene) {
  if (scene.phase !== 'modifier') return;

  const picker = scene.players.find((player) => player.id === scene.modifierPickerId);
  drawText(context, `${picker.character.displayName} picks`, SCREEN_WIDTH / 2, TITLE_Y, { scale: 3, align: 'center' });
  const left = (SCREEN_WIDTH - 2 * OPTION_WIDTH - OPTION_GAP) / 2;
  const iconSize = MODIFIER_ICON_SIZE * ICON_SCALE;
  scene.modifierOptionIds.forEach((modifierId, index) => {
    const chosen = index === scene.modifierHighlight;
    const scale = chosen ? 2 : 1;
    const name = ROUND_MODIFIERS[modifierId].name;
    const width = iconSize + ICON_GAP + measureText(name) * scale;
    const x = Math.floor(left + index * (OPTION_WIDTH + OPTION_GAP) + (OPTION_WIDTH - width) / 2);
    drawModifierIcon(context, modifierId, x, OPTION_Y - iconSize / 2, ICON_SCALE);
    const textY = OPTION_Y - Math.floor((GLYPH_HEIGHT * scale) / 2);
    const color = chosen ? CHOSEN_COLOR : OPTION_COLOR;
    drawText(context, name, x + iconSize + ICON_GAP, textY, { scale, color, outlineColor: OUTLINE_COLOR });
    if (chosen) drawPointer(context, x - POINTER_GAP - Math.ceil((GLYPH_HEIGHT * scale) / 2), textY, scale, color);
  });
  drawKeyHints(context, hintsFor(picker.id), HINT_Y);
}
