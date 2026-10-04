import { SCREEN_WIDTH } from '../engine/config.js';
import { CHARACTERS, findCharacter } from '../entities/characters.js';
import { PLAYERS } from '../levels/versus-arena.js';
import { THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '../levels/level-thumbnail.js';
import { matchModeName } from '../scenes/match-modes.js';
import { RANDOM_LEVEL } from '../scenes/online-lobby-state.js';
import { BACK_HINT, drawKeyHints, drawMenuList, MOVE_HINT, SELECT_HINT } from './menu-kit.js';
import { drawEmptySelectCard, drawSelectCard, selectCardBox } from './select-card.js';
import { drawText } from './text.js';

const SELECTED_COLOR = '#feae34';
const LABEL_COLOR = '#c0cbdc';
const DIM_COLOR = '#8b9bb4';
const EMPTY_COLOR = '#5a6988';
const OUTLINE_COLOR = '#3e2731';

const CODE_LABEL_Y = 18;
const CODE_SCALE = 6;
const CODE_Y = 33;

const CARD_TOP_Y = 76;

const MENU_TOP_Y = 206;
// The rows scroll so they stay above the hints.
const VISIBLE_ROWS = 3;
const HINTS_Y = 300;
const SIDE_PANEL_WIDTH = 148;
const SIDE_PANEL_MARGIN_X = 12;
const LEVEL_BORDER = 2;
const LEVEL_CAPTION_HEIGHT = 12;
const RANDOM_MARK_SCALE = 6;
const RANDOM_MARK_TOP_Y = 14;

const HINTS = [MOVE_HINT, SELECT_HINT, { ...BACK_HINT, label: 'Leave' }];

// Rows whose value a confirm steps to the next one. A row named here that the local player cannot use is left out by
// the scene.
export const CHANGEABLE_ROWS = ['character', 'level', 'mode'];

export function cardBox(seatIndex) {
  return selectCardBox(seatIndex, CARD_TOP_Y);
}

export function lobbyRowLabels({ rows, lobby, localSeat }) {
  const localSeatState = lobby.seats[localSeat];
  return rows.map((row) => {
    if (row === 'character') return `Character: ${findCharacter(localSeatState?.characterName)?.displayName ?? ''}`;
    if (row === 'ready') return localSeatState?.ready ? 'Cancel ready' : 'Ready up';
    if (row === 'mode') return `Mode: ${matchModeName(lobby.modeId)}`;
    if (row === 'level') return `Level: ${lobby.levelName === RANDOM_LEVEL ? 'Random' : lobby.levelName}`;
    if (row === 'start') {
      if (lobby.canStart()) return 'Start match';
      return lobby.readyCount < 2 ? 'Need two ready players' : 'Waiting for players';
    }
    return 'Leave';
  });
}

function drawCode(context, code) {
  drawText(context, 'Room code', SCREEN_WIDTH / 2, CODE_LABEL_Y, {
    scale: 1,
    align: 'center',
    color: LABEL_COLOR,
    outlineColor: OUTLINE_COLOR,
  });
  drawText(context, code, SCREEN_WIDTH / 2, CODE_Y, {
    scale: CODE_SCALE,
    align: 'center',
    color: SELECTED_COLOR,
    outlineColor: OUTLINE_COLOR,
  });
}

// A dark border around a thumbnail, the same as on the level select.
function drawBorder(context, x, y, width, height) {
  context.fillStyle = OUTLINE_COLOR;
  context.fillRect(x, y, width, LEVEL_BORDER);
  context.fillRect(x, y + height - LEVEL_BORDER, width, LEVEL_BORDER);
  context.fillRect(x, y, LEVEL_BORDER, height);
  context.fillRect(x + width - LEVEL_BORDER, y, LEVEL_BORDER, height);
}

function drawPlayerCard(context, view, seatIndex) {
  const box = cardBox(seatIndex);
  const seat = view.lobby.seats[seatIndex];
  const spawn = PLAYERS[seatIndex];
  if (!seat) {
    drawEmptySelectCard(context, box, spawn, ['Open seat', 'Waiting for a player']);
    return;
  }
  const isLocal = seatIndex === view.localSeat;
  context.save();
  context.translate(view.cardMotion.slideOffsetX(seatIndex, box), 0);
  drawSelectCard(context, {
    box,
    spawn,
    character: findCharacter(seat.characterName) ?? CHARACTERS[0],
    sprites: view.sprites,
    pose: view.cardMotion.pose(seatIndex),
    canPick: isLocal && !seat.ready,
    status: seat.ready ? { text: 'READY!', color: SELECTED_COLOR } : { text: 'Not ready', color: DIM_COLOR },
    leftBadge: seatIndex === 0 ? { text: 'Host', color: DIM_COLOR } : null,
    rightBadge: isLocal ? { text: 'You', color: '#ffffff' } : null,
  });
  context.restore();
}

function drawLevelPanel(context, view, x) {
  const width = THUMBNAIL_WIDTH + 2 * LEVEL_BORDER;
  const height = THUMBNAIL_HEIGHT + 2 * LEVEL_BORDER;
  const level = view.levels.find((candidate) => candidate.name === view.lobby.levelName);
  drawBorder(context, x, MENU_TOP_Y, width, height);
  if (level) {
    context.imageSmoothingEnabled = false;
    context.drawImage(level.thumbnail, x + LEVEL_BORDER, MENU_TOP_Y + LEVEL_BORDER);
  } else {
    drawText(context, '?', x + width / 2, MENU_TOP_Y + LEVEL_BORDER + RANDOM_MARK_TOP_Y, {
      scale: RANDOM_MARK_SCALE,
      align: 'center',
      color: EMPTY_COLOR,
    });
  }
  drawText(context, level ? level.name : 'Random', x + width / 2, MENU_TOP_Y + height + 3, {
    scale: 1,
    align: 'center',
    color: view.rows[view.selectedRow] === 'level' ? SELECTED_COLOR : LABEL_COLOR,
    outlineColor: OUTLINE_COLOR,
  });
}

function drawStatus(context, view, x) {
  const { lobby, isHost } = view;
  const lines = [
    [`Players ${lobby.playerCount} of ${PLAYERS.length}`, LABEL_COLOR],
    [`Ready ${lobby.readyCount} of ${lobby.playerCount}`, lobby.canStart() ? SELECTED_COLOR : LABEL_COLOR],
    [matchModeName(lobby.modeId), LABEL_COLOR],
    [isHost ? 'You start the match' : 'Host starts the match', DIM_COLOR],
  ];
  lines.forEach(([text, color], index) => {
    drawText(context, text, x + SIDE_PANEL_WIDTH / 2, MENU_TOP_Y + 10 + index * 12, {
      scale: 1,
      align: 'center',
      color,
      outlineColor: OUTLINE_COLOR,
    });
  });
}

// view: { code, lobby, localSeat, isHost, rows, selectedRow, sprites, levels, motion, cardMotion }.
export function drawOnlineLobby(context, view) {
  drawCode(context, view.code);
  for (let seatIndex = 0; seatIndex < PLAYERS.length; seatIndex++) drawPlayerCard(context, view, seatIndex);

  const labels = lobbyRowLabels(view);
  drawLevelPanel(context, view, SIDE_PANEL_MARGIN_X + (SIDE_PANEL_WIDTH - THUMBNAIL_WIDTH - 2 * LEVEL_BORDER) / 2);
  drawStatus(context, view, SCREEN_WIDTH - SIDE_PANEL_MARGIN_X - SIDE_PANEL_WIDTH);
  drawMenuList(context, {
    options: labels.map((label) => ({ label })),
    selectedIndex: view.selectedRow,
    topY: MENU_TOP_Y,
    motion: view.motion,
    maxRows: VISIBLE_ROWS,
  });
  drawKeyHints(context, HINTS, HINTS_Y);
}
