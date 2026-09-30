import { TICK_RATE } from '../engine/config.js';

// Display only: Pass the bomb's lit bomb in the holder's hand. The fuse never shows how long is left; its spark just
// flickers faster as the end nears.
const BOMB_ROWS = [
  '......wwww......',
  '....wwooooww....',
  '...woobbbboow...',
  '..wobbbbbbbbow..',
  '.wobbhhbbbbbbow.',
  '.wobhhbbbbbbbow.',
  'wobbhbbbbbbbbbow',
  'wobbbbbbbbbbbdow',
  'wobbbbbbbbbbddow',
  'wobbbbbbbbbdddow',
  '.wobbbbbbbdddow.',
  '.wobbbbbbddddow.',
  '..wobbbbddddow..',
  '...woobdddoow...',
  '....wwooooww....',
  '......wwww......',
];
const COLORS = { w: '#ffffff', o: '#181425', b: '#3a4466', h: '#8b9bb4', d: '#262b44' };
const FUSE_COLOR = '#a09088';
const SPARK_COLORS = ['#fee761', '#f77622'];
const BOMB_SIZE = 16;
// The bomb overlaps the holder's side by this much, so it reads as held rather than floating beside them.
const HOLD_OVERLAP = 4;
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

// The fuse sits on the side away from the holder, so it is never hidden behind them.
const FUSE_CELLS = [
  [10, 1],
  [11, 0],
  [12, -1],
  [13, -2],
];
const SPARK = { x: 13, y: -6, size: 4 };

// The body keeps its top left light either way. facing mirrors only the fuse and spark.
function drawBomb(context, x, y, sparkColor, facing) {
  const columnX = (column, width = 1) => (facing > 0 ? x + column : x + BOMB_SIZE - column - width);
  BOMB_ROWS.forEach((row, rowIndex) =>
    [...row].forEach((cell, columnIndex) => {
      if (cell === '.') return;
      context.fillStyle = COLORS[cell];
      context.fillRect(x + columnIndex, y + rowIndex, 1, 1);
    }),
  );
  context.fillStyle = FUSE_COLOR;
  for (const [column, row] of FUSE_CELLS) context.fillRect(columnX(column), y + row, 1, 1);
  context.fillStyle = sparkColor;
  context.fillRect(columnX(SPARK.x, SPARK.size), y + SPARK.y, SPARK.size, SPARK.size);
}

export function drawHeldBomb(context, scene) {
  const { holderId, fuseTicksRemaining } = scene.modeRules;
  const holder = scene.players.find((player) => player.id === holderId);
  if (!holder || holder.inWater) return;
  const flicker = Math.floor(scene.tickCount / sparkFlickerTicks(fuseTicksRemaining)) % SPARK_COLORS.length;
  const x = Math.round(
    holder.facing > 0 ? holder.x + holder.width - HOLD_OVERLAP : holder.x - BOMB_SIZE + HOLD_OVERLAP,
  );
  const y = Math.round(holder.y + holder.height / 2 - BOMB_SIZE / 2);
  drawBomb(context, x, y, SPARK_COLORS[flicker], holder.facing);
}
