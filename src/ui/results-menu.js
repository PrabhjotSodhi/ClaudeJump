import { SCREEN_WIDTH } from '../engine/config.js';
import { drawCharacterBody, FRAME_SIZE } from '../vfx/character-body.js';
import { drawKeyHints, drawMenuList, KEYCAP_HEIGHT, menuPanelSize } from './menu-kit.js';
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

const STAGE_WIDTH = 192;
const STAGE_TOP_Y = 48;
const STAGE_HEIGHT = 92;
const FLOOR_HEIGHT = 12;
const FLOOR_COLOR = '#3a4466';
const FLOOR_EDGE_COLOR = '#5a6988';

const STATS_PANEL_WIDTH = 128;
const STATS_PANEL_HEIGHT = 64;
const STATS_PANEL_MARGIN_X = 48;
const STATS_PANEL_TOP_Y = 64;
const STATS_ACCENT_HEIGHT = 3;
const STATS_TEXT_INSET = 12;
const STATS_ROW_HEIGHT = 14;
const STATS_FIRST_ROW_Y = 12;
const STATS_LABEL_COLOR = '#c0cbdc';

const MENU_TOP_Y = 172;
const HINT_GAP = 14;
const HINTS = [{ keys: ['Enter', 'A'], label: 'Select' }];

// Every rectangle of the results screen, in whole pixels. The winner stands on the pedestal in the middle,
// the loser stands beside it, and each player's stats panel sits at their own side of the screen.
export function resultsLayout({ winnerIndex, menuHeight }) {
  const stage = { x: (SCREEN_WIDTH - STAGE_WIDTH) / 2, y: STAGE_TOP_Y, width: STAGE_WIDTH, height: STAGE_HEIGHT };
  const floorY = stage.y + stage.height - 2 - FLOOR_HEIGHT;
  const pedestalTopY = floorY - PEDESTAL_BLOCK_SIZE;
  const pedestalX = (SCREEN_WIDTH - PEDESTAL_WIDTH) / 2;
  const loserX = winnerIndex === 0 ? pedestalX + PEDESTAL_WIDTH + LOSER_GAP : pedestalX - LOSER_GAP - FRAME_SIZE;
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
    loser: { x: loserX, y: floorY - FRAME_SIZE, width: FRAME_SIZE, height: FRAME_SIZE },
    statsPanels: [STATS_PANEL_MARGIN_X, SCREEN_WIDTH - STATS_PANEL_MARGIN_X - STATS_PANEL_WIDTH].map((x) => ({
      x,
      y: STATS_PANEL_TOP_Y,
      width: STATS_PANEL_WIDTH,
      height: STATS_PANEL_HEIGHT,
    })),
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

function drawStatsPanel(context, panel, player, matchScene) {
  drawPanel(context, panel.x, panel.y, panel.width, panel.height);
  context.fillStyle = player.color;
  context.fillRect(panel.x + 2, panel.y + 2, panel.width - 4, STATS_ACCENT_HEIGHT);

  const textX = panel.x + STATS_TEXT_INSET;
  const firstRowY = panel.y + STATS_FIRST_ROW_Y + STATS_ACCENT_HEIGHT;
  const rows = [
    [player.character.displayName, player.color],
    [`Rounds won ${matchScene.wins[player.id]}`, STATS_LABEL_COLOR],
    [`Falls ${matchScene.matchStats.fallsIn[player.id]}`, STATS_LABEL_COLOR],
  ];
  rows.forEach(([text, color], index) => {
    drawText(context, text, textX, firstRowY + index * STATS_ROW_HEIGHT, { scale: 1, color, outlineColor: null });
  });
}

export function drawResultsMenu(context, { matchScene, options, selectedIndex }) {
  const winnerIndex = matchScene.players.findIndex((player) => player.id === matchScene.winnerId);
  const winner = matchScene.players[winnerIndex];
  const loser = matchScene.players[1 - winnerIndex];
  const menuHeight = menuPanelSize(options.map((option) => option.label)).height;
  const layout = resultsLayout({ winnerIndex, menuHeight });

  drawMenuBackdrop(context);
  drawBanner(context, layout.banner, winner.color);
  drawStage(context, layout);
  drawPedestal(context, layout.pedestal, matchScene.level.tileSprites);
  drawCharacter(context, { player: loser, box: layout.loser, matchScene });
  drawCharacter(context, { player: winner, box: layout.winner, matchScene });
  matchScene.players.forEach((player, index) => drawStatsPanel(context, layout.statsPanels[index], player, matchScene));
  drawMenuList(context, { options, selectedIndex, topY: layout.menuTopY });
  drawKeyHints(context, HINTS, layout.hintY);
}
