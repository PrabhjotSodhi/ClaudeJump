import { AWARD_POP_TICKS, SCREEN_WIDTH } from '../engine/config.js';
import { drawCharacterBody, FRAME_SIZE } from '../vfx/character-body.js';
import {
  drawKeyHints,
  drawMenuList,
  drawWithMenuMotion,
  KEYCAP_HEIGHT,
  menuPanelSize,
  menuRowRectangles,
} from './menu-kit.js';
import { rankPlayers } from './match-stats.js';
import { drawMenuBackdrop } from './menu-options.js';
import { drawPanel } from './panel.js';
import { drawText, measureText } from './text.js';

const BANNER_TEXT = 'Winner';
const BANNER_TEXT_SCALE = 2;
const BANNER_TEXT_HEIGHT = 10;
const BANNER_PADDING_X = 16;
const BANNER_PADDING_Y = 7;
const BANNER_TOP_Y = 16;
const BANNER_STRIPE_HEIGHT = 2;

const PEDESTAL_BLOCK_SIZE = 32;
const PEDESTAL_BLOCKS = 2;
const PEDESTAL_WIDTH = PEDESTAL_BLOCK_SIZE * PEDESTAL_BLOCKS;
const LOSER_GAP = 12;
// A second player on the same side of the pedestal stands beyond the first.
const FAR_LOSER_GAP = 4;

// Four players need a wider stage to stand on.
const STAGE_WIDTH_BY_PLAYER_COUNT = { 2: 192, 3: 192, 4: 256 };
const STAGE_TOP_Y = 48;
const STAGE_HEIGHT = 92;
const FLOOR_HEIGHT = 12;
const FLOOR_COLOR = '#3a4466';
const FLOOR_EDGE_COLOR = '#5a6988';

const STATS_PANEL_WIDTH = 128;
const STATS_PANEL_HEIGHT = 76;
const STATS_PANEL_MARGIN_X = 48;
const STATS_PANEL_TOP_Y = 64;
// With more than two players the panels sit two to a row, so they start higher.
const STATS_GRID_TOP_Y = 48;
const STATS_GRID_GAP = 8;
const STATS_ACCENT_HEIGHT = 3;
const STATS_TEXT_INSET = 12;
const STATS_ROW_HEIGHT = 14;
const STATS_FIRST_ROW_Y = 12;
const STATS_LABEL_COLOR = '#c0cbdc';
const AWARD_COLOR = '#feae34';
const AWARD_FLASH_COLOR = '#ffffff';
const AWARD_FLASH_TICKS = 4;

const MENU_TOP_Y = 172;
const HINT_GAP = 14;
const HINTS = [{ keys: ['Enter'], pad: ['south'], label: 'Select' }];

// The stats panel positions. Two players each get their own side of the screen. More players fill rows of two,
// left then right, in the order the panels are given.
function statsPanelBoxes(playerCount) {
  const columnXs = [STATS_PANEL_MARGIN_X, SCREEN_WIDTH - STATS_PANEL_MARGIN_X - STATS_PANEL_WIDTH];
  return Array.from({ length: playerCount }, (_, index) => {
    const row = playerCount === 2 ? 0 : Math.floor(index / 2);
    const topY = playerCount === 2 ? STATS_PANEL_TOP_Y : STATS_GRID_TOP_Y;
    return {
      x: columnXs[index % 2],
      y: topY + row * (STATS_PANEL_HEIGHT + STATS_GRID_GAP),
      width: STATS_PANEL_WIDTH,
      height: STATS_PANEL_HEIGHT,
    };
  });
}

// Every rectangle of the results screen, in whole pixels. The winner stands on the pedestal in the middle and
// the others stand beside it in rank order, alternating sides, the second place first on the side away from
// the winner's seat. Stats panels sit at the sides of the screen.
export function resultsLayout({ winnerIndex, playerCount, menuHeight }) {
  const stageWidth = STAGE_WIDTH_BY_PLAYER_COUNT[playerCount];
  const stage = { x: (SCREEN_WIDTH - stageWidth) / 2, y: STAGE_TOP_Y, width: stageWidth, height: STAGE_HEIGHT };
  const floorY = stage.y + stage.height - 2 - FLOOR_HEIGHT;
  const pedestalTopY = floorY - PEDESTAL_BLOCK_SIZE;
  const pedestalX = (SCREEN_WIDTH - PEDESTAL_WIDTH) / 2;
  const sides = winnerIndex === 0 ? ['right', 'left', 'right'] : ['left', 'right', 'left'];
  const placedBySide = { left: 0, right: 0 };
  const losers = sides.slice(0, playerCount - 1).map((side) => {
    const step = placedBySide[side]++ * (FRAME_SIZE + FAR_LOSER_GAP);
    const x =
      side === 'right' ? pedestalX + PEDESTAL_WIDTH + LOSER_GAP + step : pedestalX - LOSER_GAP - FRAME_SIZE - step;
    return { x, y: floorY - FRAME_SIZE, width: FRAME_SIZE, height: FRAME_SIZE };
  });
  const bannerWidth = measureText(BANNER_TEXT) * BANNER_TEXT_SCALE + 2 * BANNER_PADDING_X;
  const menuBottomY = MENU_TOP_Y + menuHeight;
  return {
    stage,
    floorY,
    banner: {
      x: Math.floor((SCREEN_WIDTH - bannerWidth) / 2),
      y: BANNER_TOP_Y,
      width: bannerWidth,
      height: BANNER_TEXT_HEIGHT + 2 * BANNER_PADDING_Y,
    },
    winner: {
      x: (SCREEN_WIDTH - FRAME_SIZE) / 2,
      y: pedestalTopY - FRAME_SIZE,
      width: FRAME_SIZE,
      height: FRAME_SIZE,
    },
    pedestal: { x: pedestalX, y: pedestalTopY, width: PEDESTAL_WIDTH, height: PEDESTAL_BLOCK_SIZE },
    losers,
    statsPanels: statsPanelBoxes(playerCount),
    menuTopY: MENU_TOP_Y,
    hintY: menuBottomY + HINT_GAP,
    hintBottomY: menuBottomY + HINT_GAP + KEYCAP_HEIGHT,
  };
}

function drawBanner(context, banner, color) {
  drawPanel(context, banner.x, banner.y, banner.width, banner.height);
  context.fillStyle = color;
  context.fillRect(banner.x + 2, banner.y + 3, banner.width - 4, BANNER_STRIPE_HEIGHT);
  context.fillRect(
    banner.x + 2,
    banner.y + banner.height - 3 - BANNER_STRIPE_HEIGHT,
    banner.width - 4,
    BANNER_STRIPE_HEIGHT,
  );
  drawText(context, BANNER_TEXT, banner.x + banner.width / 2, banner.y + BANNER_PADDING_Y, {
    scale: BANNER_TEXT_SCALE,
    align: 'center',
    color,
    outlineColor: null,
  });
}

function drawStage(context, { stage, floorY }) {
  drawPanel(context, stage.x, stage.y, stage.width, stage.height);
  context.fillStyle = FLOOR_COLOR;
  context.fillRect(stage.x + 2, floorY, stage.width - 4, FLOOR_HEIGHT);
  context.fillStyle = FLOOR_EDGE_COLOR;
  context.fillRect(stage.x + 2, floorY, stage.width - 4, 1);
}

function drawPedestal(context, pedestal, blockSprites) {
  for (let block = 0; block < PEDESTAL_BLOCKS; block++)
    context.drawImage(blockSprites[`block-big-${block % 2}`], pedestal.x + block * PEDESTAL_BLOCK_SIZE, pedestal.y);
}

function drawCharacter(context, { player, box, matchScene }) {
  drawCharacterBody(context, {
    sprite: matchScene.sprites[player.character.spriteName].body,
    eyeFramePositions: player.character.eyeFramePositions,
    eyes: matchScene.playerEyes.eyesFor(player.id),
    centerX: box.x + box.width / 2,
    bottomY: box.y + box.height,
    width: box.width,
    height: box.height,
  });
}

const ORDINALS = ['1st', '2nd', '3rd', '4th'];

// rank is null when the screen does not show one.
function drawStatsPanel(context, panel, player, rank, matchScene, awardReveal) {
  drawPanel(context, panel.x, panel.y, panel.width, panel.height);
  context.fillStyle = player.color;
  context.fillRect(panel.x + 2, panel.y + 2, panel.width - 4, STATS_ACCENT_HEIGHT);

  const textX = panel.x + STATS_TEXT_INSET;
  const firstRowY = panel.y + STATS_FIRST_ROW_Y + STATS_ACCENT_HEIGHT;
  const rows = [
    [rank ? `${ORDINALS[rank - 1]} ${player.character.displayName}` : player.character.displayName, player.color],
    [`Rounds won ${matchScene.wins[player.id]}`, STATS_LABEL_COLOR],
    [`Falls ${matchScene.matchStats.fallsIn[player.id]}`, STATS_LABEL_COLOR],
  ];
  rows.forEach(([text, color], index) => {
    drawText(context, text, textX, firstRowY + index * STATS_ROW_HEIGHT, { scale: 1, color, outlineColor: null });
  });

  const ticksSinceShown = awardReveal?.ticksSinceShown(player.id) ?? -1;
  if (ticksSinceShown < 0) return;
  // A new award hops up and settles down, and flashes white while it does.
  const hop = Math.max(0, Math.floor((AWARD_POP_TICKS - ticksSinceShown) / 2));
  drawText(context, awardReveal.awardFor(player.id).label, textX, firstRowY + rows.length * STATS_ROW_HEIGHT - hop, {
    scale: 1,
    color: ticksSinceShown < AWARD_FLASH_TICKS ? AWARD_FLASH_COLOR : AWARD_COLOR,
    outlineColor: null,
  });
}

export function resultsMenuRowRectangles(options) {
  return menuRowRectangles(
    options.map((option) => option.label),
    MENU_TOP_Y,
  );
}

export function drawResultsMenu(context, { matchScene, options, selectedIndex, motion, awardReveal }) {
  const winnerIndex = matchScene.players.findIndex((player) => player.id === matchScene.winnerId);
  const winner = matchScene.players[winnerIndex];
  const playerCount = matchScene.players.length;
  const ranked = rankPlayers(
    matchScene.players.map((player) => player.id),
    matchScene.wins,
  ).map(({ playerId, rank }) => ({ player: matchScene.players.find((player) => player.id === playerId), rank }));
  const losers = ranked.filter(({ player }) => player !== winner);
  const menuHeight = menuPanelSize(options.map((option) => option.label)).height;
  const layout = resultsLayout({ winnerIndex, playerCount, menuHeight });

  drawMenuBackdrop(context);
  drawWithMenuMotion(context, motion, () => {
    drawBanner(context, layout.banner, winner.color);
    drawStage(context, layout);
    drawPedestal(context, layout.pedestal, matchScene.level.tileSprites);
    losers.forEach(({ player }, index) => drawCharacter(context, { player, box: layout.losers[index], matchScene }));
    drawCharacter(context, { player: winner, box: layout.winner, matchScene });
    // Two players keep their own side. More are shown in rank order with their place named.
    if (playerCount === 2) {
      matchScene.players.forEach((player, index) =>
        drawStatsPanel(context, layout.statsPanels[index], player, null, matchScene, awardReveal),
      );
    } else {
      ranked.forEach(({ player, rank }, index) =>
        drawStatsPanel(context, layout.statsPanels[index], player, rank, matchScene, awardReveal),
      );
    }
    drawMenuList(context, { options, selectedIndex, topY: layout.menuTopY, motion });
    drawKeyHints(context, HINTS, layout.hintY);
  });
}
