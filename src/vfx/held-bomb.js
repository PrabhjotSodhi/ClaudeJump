import { TICK_RATE } from '../engine/config.js';

// Display only: Pass the bomb's lit bomb in the holder's hand. The fuse never shows how long is left; its spark just
// flickers faster as the end nears.
const BOMB_ROWS = [
  '...wwww...',
  '..woooow..',
  '.wobbbbow.',
  'wobhhbbbow',
  'wobhbbbbow',
  'wobbbbbbow',
  'wobbbbbbow',
  '.wobbbbow.',
  '..woooow..',
  '...wwww...',
];
const COLORS = { w: '#ffffff', o: '#181425', b: '#3a4466', h: '#8b9bb4' };
const FUSE_COLOR = '#a09088';
const SPARK_COLORS = ['#fee761', '#f77622'];
const BOMB_SIZE = 10;
// How long each spark color shows, by the fuse ticks left: the first entry whose limit is above what is left wins.
const FLICKER_TICKS_BY_REMAINING = [
  { below: TICK_RATE / 2, flickerTicks: 2 },
  { below: TICK_RATE * 1.5, flickerTicks: 4 },
  { below: TICK_RATE * 3, flickerTicks: 8 },
  { below: Infinity, flickerTicks: 16 },
];

export function sparkFlickerTicks(fuseTicksRemaining) {
  return FLICKER_TICKS_BY_REMAINING.find(({ below }) => fuseTicksRemaining < below).flickerTicks;
}

function drawBomb(context, x, y, sparkColor) {
  BOMB_ROWS.forEach((row, rowIndex) =>
    [...row].forEach((cell, columnIndex) => {
      if (cell === '.') return;
      context.fillStyle = COLORS[cell];
      context.fillRect(x + columnIndex, y + rowIndex, 1, 1);
    }),
  );
  context.fillStyle = FUSE_COLOR;
  context.fillRect(x + 6, y, 1, 1);
  context.fillRect(x + 7, y - 1, 1, 1);
  context.fillRect(x + 8, y - 2, 1, 1);
  context.fillStyle = sparkColor;
  context.fillRect(x + 8, y - 5, 3, 3);
}

export function drawHeldBomb(context, scene) {
  const { holderId, fuseTicksRemaining } = scene.modeRules;
  const holder = scene.players.find((player) => player.id === holderId);
  if (!holder || holder.inWater) return;
  const flicker = Math.floor(scene.tickCount / sparkFlickerTicks(fuseTicksRemaining)) % SPARK_COLORS.length;
  const x = Math.round(holder.facing > 0 ? holder.x + holder.width : holder.x - BOMB_SIZE);
  const y = Math.round(holder.y + holder.height / 2 - BOMB_SIZE / 2);
  drawBomb(context, x, y, SPARK_COLORS[flicker]);
}
