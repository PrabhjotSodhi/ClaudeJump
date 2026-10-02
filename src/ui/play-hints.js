import { PLAYERS } from '../levels/versus-arena.js';
import { drawKeyHintRows } from './menu-kit.js';

const KEYBOARD_PLAYER_IDS = ['red', 'blue'];
const PAD_LABEL_COLOR = '#c0cbdc';
const PANEL_WIDTH = 300;

function playerLabel(playerId) {
  return playerId[0].toUpperCase() + playerId.slice(1);
}

function keyboardRow(playerId, shove) {
  const hints = [
    {
      keys: [
        { player: playerId, control: 'left' },
        { player: playerId, control: 'right' },
      ],
      label: 'Move',
    },
    { keys: [{ player: playerId, control: 'jump' }], label: 'Jump' },
  ];
  if (shove) hints.push({ keys: [{ player: playerId, control: 'action' }], label: 'Shove' });
  return {
    label: playerLabel(playerId),
    device: 'keyboard',
    color: PLAYERS.find((spawn) => spawn.id === playerId).color,
    hints,
  };
}

function padRow(shove) {
  const hints = [
    { keys: ['Stick'], pad: ['stick'], label: 'Move' },
    { keys: ['A'], pad: ['south'], label: 'Jump' },
  ];
  if (shove) hints.push({ keys: ['B'], pad: ['east'], label: 'Shove' });
  return { label: 'Pad', device: 'pad', color: PAD_LABEL_COLOR, hints };
}

// The rows of move, jump and shove hints for the players in a match: one row per keyboard player,
// shown on the keyboard, and one row shown on a pad. Survival has no one to shove.
export function playHintRows(playerIds, { shove }) {
  const keyboardRows = KEYBOARD_PLAYER_IDS.filter((playerId) => playerIds.includes(playerId)).map((playerId) =>
    keyboardRow(playerId, shove),
  );
  return [...keyboardRows, padRow(shove)];
}

export function drawPlayHints(context, rows, topY) {
  drawKeyHintRows(context, rows, { topY, width: PANEL_WIDTH });
}
