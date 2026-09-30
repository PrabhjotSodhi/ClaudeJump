import { SCREEN_WIDTH } from '../engine/config.js';
import { CHARACTERS, findCharacter } from '../entities/characters.js';
import { PLAYERS } from '../levels/versus-arena.js';
import { THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '../levels/level-thumbnail.js';
import { drawCharacterBody, FRAME_SIZE } from '../vfx/character-body.js';
import { EYE_STIFFNESSES, GooglyEye } from '../vfx/googly-eyes.js';
import { RANDOM_LEVEL } from '../scenes/online-lobby-state.js';
import { drawKeyHints, drawMenuList, menuRowRectangles } from './menu-kit.js';
import { drawPanel } from './panel.js';
import { drawText, measureText } from './text.js';

const SELECTED_COLOR = '#feae34';
const LABEL_COLOR = '#c0cbdc';
const DIM_COLOR = '#8b9bb4';
const EMPTY_COLOR = '#5a6988';

const CODE_PANEL_TOP_Y = 12;
const CODE_PANEL_WIDTH = 148;
const CODE_PANEL_HEIGHT = 56;
const CODE_LABEL_Y = CODE_PANEL_TOP_Y + 8;
const CODE_SCALE = 5;
const CODE_Y = CODE_PANEL_TOP_Y + 21;

const CARD_TOP_Y = 80;
const CARD_WIDTH = 148;
const CARD_HEIGHT = 96;
const CARD_GAP = 8;
const CARD_FRAME_INSET = 3;
const CARD_LABEL_Y = CARD_TOP_Y + 8;
const CARD_BADGE_INSET = 8;
const CHARACTER_BOTTOM_Y = CARD_TOP_Y + 62;
const LEDGE_WIDTH = 56;
const LEDGE_HEIGHT = 8;
const NAME_Y = CARD_TOP_Y + 72;
const STATUS_Y = CARD_TOP_Y + 84;
const ARROW_DEPTH = 3;
const ARROW_GAP = 6;
const ROW_ARROW_INSET = 5;

const MENU_TOP_Y = 190;
const HINTS_Y = 292;
const SIDE_PANEL_WIDTH = 148;
const SIDE_PANEL_MARGIN_X = 12;
const LEVEL_BORDER = 2;
const LEVEL_CAPTION_HEIGHT = 12;
const RANDOM_MARK_SCALE = 6;
const RANDOM_MARK_TOP_Y = 14;

const HINTS = [
  { keys: ['Up', 'Down'], label: 'Choose' },
  { keys: ['Left', 'Right'], label: 'Change' },
  { keys: ['Enter', 'A'], label: 'Select' },
];
const TOUCH_HINT = 'Tap a row. Tap its sides to change';

// Rows the menu can hold. A row named here that the local player cannot use is left out by the scene.
export const CHANGEABLE_ROWS = ['character', 'level'];

const PORTRAIT_EYES = EYE_STIFFNESSES.map((stiffness) => new GooglyEye(stiffness));

export function cardBox(seatIndex) {
  const totalWidth = PLAYERS.length * CARD_WIDTH + (PLAYERS.length - 1) * CARD_GAP;
  return {
    x: (SCREEN_WIDTH - totalWidth) / 2 + seatIndex * (CARD_WIDTH + CARD_GAP),
    y: CARD_TOP_Y,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  };
}

export function lobbyRowLabels({ rows, lobby, localSeat }) {
  const localSeatState = lobby.seats[localSeat];
  return rows.map((row) => {
    if (row === 'character') return `Character: ${findCharacter(localSeatState?.characterName)?.displayName ?? ''}`;
    if (row === 'ready') return localSeatState?.ready ? 'Cancel ready' : 'Ready up';
    if (row === 'level') return `Level: ${lobby.levelName === RANDOM_LEVEL ? 'Random' : lobby.levelName}`;
    if (row === 'start') {
      if (lobby.canStart()) return 'Start match';
      return lobby.readyCount < 2 ? 'Need two ready players' : 'Waiting for players';
    }
    return 'Leave';
  });
}

export function lobbyRowRectangles(labels) {
  return menuRowRectangles(labels, MENU_TOP_Y);
}

function drawFrame(context, x, y, width, height, color) {
  context.fillStyle = color;
  context.fillRect(x, y, width, 1);
  context.fillRect(x, y + height - 1, width, 1);
  context.fillRect(x, y + 1, 1, height - 2);
  context.fillRect(x + width - 1, y + 1, 1, height - 2);
}

function drawArrows(context, centerX, labelWidth, topY, color) {
  const labelLeftX = centerX - Math.floor(labelWidth / 2);
  const leftArrowRightX = labelLeftX - ARROW_GAP;
  const rightArrowLeftX = labelLeftX + labelWidth + ARROW_GAP;
  context.fillStyle = color;
  for (let row = 0; row < ARROW_DEPTH * 2 - 1; row++) {
    const width = ARROW_DEPTH - Math.abs(row - (ARROW_DEPTH - 1));
    context.fillRect(leftArrowRightX - width, topY + row, width, 1);
    context.fillRect(rightArrowLeftX, topY + row, width, 1);
  }
}

function drawCode(context, code) {
  drawPanel(context, (SCREEN_WIDTH - CODE_PANEL_WIDTH) / 2, CODE_PANEL_TOP_Y, CODE_PANEL_WIDTH, CODE_PANEL_HEIGHT);
  drawText(context, 'Room code', SCREEN_WIDTH / 2, CODE_LABEL_Y, {
    scale: 1,
    align: 'center',
    color: LABEL_COLOR,
    outlineColor: null,
  });
  drawText(context, code, SCREEN_WIDTH / 2, CODE_Y, { scale: CODE_SCALE, align: 'center', color: SELECTED_COLOR });
}

function drawEmptyCard(context, card) {
  drawPanel(context, card.x, card.y, card.width, card.height);
  drawFrame(
    context,
    card.x + CARD_FRAME_INSET,
    card.y + CARD_FRAME_INSET,
    card.width - 2 * CARD_FRAME_INSET,
    card.height - 2 * CARD_FRAME_INSET,
    '#3a4466',
  );
  const centerX = card.x + card.width / 2;
  for (const [text, y] of [
    ['Open seat', card.y + 38],
    ['Waiting for a player', card.y + 50],
  ]) {
    drawText(context, text, centerX, y, { scale: 1, align: 'center', color: EMPTY_COLOR, outlineColor: null });
  }
}

function drawPlayerCard(context, view, seatIndex) {
  const card = cardBox(seatIndex);
  const seat = view.lobby.seats[seatIndex];
  if (!seat) {
    drawEmptyCard(context, card);
    return;
  }
  context.save();
  context.translate(view.cardMotion.slideOffsetX(seatIndex, card), 0);
  const spawn = PLAYERS[seatIndex];
  const character = findCharacter(seat.characterName) ?? CHARACTERS[0];
  const centerX = card.x + card.width / 2;
  const isLocal = seatIndex === view.localSeat;

  drawPanel(context, card.x, card.y, card.width, card.height);
  drawFrame(
    context,
    card.x + CARD_FRAME_INSET,
    card.y + CARD_FRAME_INSET,
    card.width - 2 * CARD_FRAME_INSET,
    card.height - 2 * CARD_FRAME_INSET,
    spawn.color,
  );
  drawText(context, `${spawn.id[0].toUpperCase()}${spawn.id.slice(1)}`, centerX, CARD_LABEL_Y, {
    scale: 1,
    align: 'center',
    color: spawn.color,
    outlineColor: null,
  });
  if (seatIndex === 0) {
    drawText(context, 'Host', card.x + CARD_BADGE_INSET, CARD_LABEL_Y, {
      scale: 1,
      color: DIM_COLOR,
      outlineColor: null,
    });
  }
  if (isLocal) {
    drawText(context, 'You', card.x + card.width - CARD_BADGE_INSET, CARD_LABEL_Y, {
      scale: 1,
      align: 'right',
      color: '#ffffff',
      outlineColor: null,
    });
  }

  const ledgeX = centerX - LEDGE_WIDTH / 2;
  const ledgeY = CHARACTER_BOTTOM_Y - 1;
  context.fillStyle = '#3e2731';
  context.fillRect(ledgeX, ledgeY, LEDGE_WIDTH, LEDGE_HEIGHT);
  context.fillStyle = '#585050';
  context.fillRect(ledgeX + 1, ledgeY + 1, LEDGE_WIDTH - 2, LEDGE_HEIGHT - 2);
  context.fillStyle = '#a09088';
  context.fillRect(ledgeX + 1, ledgeY + 1, LEDGE_WIDTH - 2, 1);
  const pose = view.cardMotion.pose(seatIndex);
  drawCharacterBody(context, {
    sprite: view.sprites[character.spriteName].body,
    eyeFramePositions: character.eyeFramePositions,
    eyes: PORTRAIT_EYES,
    centerX,
    bottomY: CHARACTER_BOTTOM_Y - pose.offsetY,
    width: pose.width,
    height: pose.height,
  });

  drawText(context, character.displayName, centerX, NAME_Y, {
    scale: 1,
    align: 'center',
    color: character.tagColor,
    outlineColor: null,
  });
  if (isLocal && !seat.ready)
    drawArrows(context, centerX, measureText(character.displayName), NAME_Y, character.tagColor);
  drawText(context, seat.ready ? 'READY!' : 'Not ready', centerX, STATUS_Y, {
    scale: 1,
    align: 'center',
    color: seat.ready ? SELECTED_COLOR : DIM_COLOR,
    outlineColor: null,
  });
  context.restore();
}

function drawLevelPanel(context, view, x) {
  const width = THUMBNAIL_WIDTH + 2 * LEVEL_BORDER;
  const height = THUMBNAIL_HEIGHT + 2 * LEVEL_BORDER;
  const level = view.levels.find((candidate) => candidate.name === view.lobby.levelName);
  drawPanel(context, x, MENU_TOP_Y, width, height);
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
    outlineColor: null,
  });
}

function drawStatusPanel(context, view, x) {
  const { lobby, isHost } = view;
  const lines = [
    [`Players ${lobby.playerCount} of ${PLAYERS.length}`, LABEL_COLOR],
    [`Ready ${lobby.readyCount} of ${lobby.playerCount}`, lobby.canStart() ? SELECTED_COLOR : LABEL_COLOR],
    [isHost ? 'You start the match' : 'Host starts the match', DIM_COLOR],
  ];
  drawPanel(context, x, MENU_TOP_Y, SIDE_PANEL_WIDTH, 50);
  lines.forEach(([text, color], index) => {
    drawText(context, text, x + SIDE_PANEL_WIDTH / 2, MENU_TOP_Y + 10 + index * 12, {
      scale: 1,
      align: 'center',
      color,
      outlineColor: null,
    });
  });
}

// view: { code, lobby, localSeat, isHost, rows, selectedRow, sprites, levels, touchActive, motion, cardMotion }.
export function drawOnlineLobby(context, view) {
  drawCode(context, view.code);
  for (let seatIndex = 0; seatIndex < PLAYERS.length; seatIndex++) drawPlayerCard(context, view, seatIndex);

  const labels = lobbyRowLabels(view);
  drawLevelPanel(context, view, SIDE_PANEL_MARGIN_X + (SIDE_PANEL_WIDTH - THUMBNAIL_WIDTH - 2 * LEVEL_BORDER) / 2);
  drawStatusPanel(context, view, SCREEN_WIDTH - SIDE_PANEL_MARGIN_X - SIDE_PANEL_WIDTH);
  drawMenuList(context, {
    options: labels.map((label) => ({ label })),
    selectedIndex: view.selectedRow,
    topY: MENU_TOP_Y,
    motion: view.motion,
  });
  if (CHANGEABLE_ROWS.includes(view.rows[view.selectedRow])) {
    const row = lobbyRowRectangles(labels)[view.selectedRow];
    const arrowTopY = row.y + Math.floor((row.height - 2 * ARROW_DEPTH + 1) / 2);
    drawArrows(
      context,
      SCREEN_WIDTH / 2,
      row.width - 2 * (ARROW_GAP + ARROW_DEPTH + ROW_ARROW_INSET),
      arrowTopY,
      SELECTED_COLOR,
    );
  }
  if (view.touchActive) {
    drawText(context, TOUCH_HINT, SCREEN_WIDTH / 2, HINTS_Y + 3, {
      scale: 1,
      align: 'center',
      color: LABEL_COLOR,
      outlineColor: null,
    });
  } else {
    drawKeyHints(context, HINTS, HINTS_Y);
  }
}
