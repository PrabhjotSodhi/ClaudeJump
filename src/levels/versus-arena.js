import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';

export const PLAYERS = [
  { id: 'red', color: '#dc2828' },
  { id: 'blue', color: '#2846dc' },
];

const SKY_TOP_COLOR = [30, 110, 230];
const SKY_BOTTOM_COLOR = [110, 210, 255];

const DARKEST = '#181425';
const DEEP = '#262b44';
const DIM = '#3a4466';
const MUTED = '#5a6988';
const STATUS_LIGHT = '#0099db';
const BRIGHT_STATUS_LIGHT = '#2ce8f5';

// Each level file names its background. Arena backgrounds use cool greys and deep blue only, one or
// two values darker than the platforms, so nothing behind the fight competes with the players.
const DRAW_BY_BACKGROUND_NAME = {
  harbor: drawHarbor,
  rooftops: drawRooftops,
  cave: drawCave,
  'server-farm': drawServerFarm,
};

export function drawArenaBackground(context, backgroundName) {
  DRAW_BY_BACKGROUND_NAME[backgroundName](context);
}

function drawHarbor(context) {
  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    const progress = y / (SCREEN_HEIGHT - 1);
    const color = SKY_TOP_COLOR.map((start, index) => Math.round(start + (SKY_BOTTOM_COLOR[index] - start) * progress));
    context.fillStyle = `rgb(${color})`;
    context.fillRect(0, y, SCREEN_WIDTH, 1);
  }
}

// A number from 0 to 1 that is always the same for the same index, so a background never changes between draws.
function scatter(index) {
  return (Math.imul(index + 1, 2654435761) >>> 0) / 2 ** 32;
}

// Flat bands of color from each top y down, joined by a checkered strip so one band steps into the next.
function drawBands(context, bands) {
  bands.forEach(([color, topY], index) => {
    context.fillStyle = color;
    context.fillRect(0, topY, SCREEN_WIDTH, SCREEN_HEIGHT - topY);
    if (index === 0) return;
    for (let y = topY - 4; y < topY; y++) {
      for (let x = y % 2; x < SCREEN_WIDTH; x += 2) context.fillRect(x, y, 1, 1);
    }
  });
}

// A row of flat topped buildings from x 0 to the screen width, with a few windows and antennas.
function drawSkyline(context, { color, windowColor, lowestTopY, highestTopY, seed }) {
  let x = 0;
  for (let index = seed; x < SCREEN_WIDTH; index++) {
    const width = 18 + Math.floor(scatter(index) * 28);
    const topY = Math.round(lowestTopY - scatter(index + 100) * (lowestTopY - highestTopY));
    context.fillStyle = color;
    context.fillRect(x, topY, width, SCREEN_HEIGHT - topY);
    if (scatter(index + 200) < 0.3) context.fillRect(x + Math.floor(width / 3), topY - 8, 1, 8);
    context.fillStyle = windowColor;
    for (let windowY = topY + 5; windowY < SCREEN_HEIGHT; windowY += 7) {
      for (let windowX = x + 3; windowX < x + width - 3; windowX += 5) {
        if (scatter(windowX * 31 + windowY) < 0.12) context.fillRect(windowX, windowY, 2, 2);
      }
    }
    x += width + 2 + Math.floor(scatter(index + 300) * 6);
  }
}

function drawRooftops(context) {
  drawBands(context, [
    [DEEP, 0],
    [DIM, 110],
    [MUTED, 196],
  ]);
  context.fillStyle = MUTED;
  context.fillRect(468, 52, 12, 14);
  context.fillRect(466, 54, 16, 10);
  drawSkyline(context, { color: DIM, windowColor: MUTED, lowestTopY: 236, highestTopY: 176, seed: 0 });
  drawSkyline(context, { color: DEEP, windowColor: DIM, lowestTopY: 290, highestTopY: 246, seed: 50 });
}

// Rock that hangs from the ceiling or rises from the floor as ragged points, one pixel column at a time.
function drawRockPoints(context, { color, fromTop, baseY, maxLength, seed }) {
  context.fillStyle = color;
  for (let x = 0; x < SCREEN_WIDTH; x += 2) {
    const point = Math.abs(Math.sin(x * 0.045 + seed)) * Math.abs(Math.sin(x * 0.13 + seed * 2));
    const length = Math.round(point * maxLength) + Math.floor(scatter(x + seed) * 4);
    if (fromTop) context.fillRect(x, 0, 2, baseY + length);
    else context.fillRect(x, baseY - length, 2, SCREEN_HEIGHT - baseY + length);
  }
}

function drawCave(context) {
  context.fillStyle = DEEP;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  for (const [centerX, width] of [
    [70, 60],
    [250, 34],
    [410, 44],
    [590, 56],
  ]) {
    for (let y = 0; y < SCREEN_HEIGHT; y += 4) {
      const wobble = Math.round(Math.sin(y * 0.05 + centerX) * 6 + scatter(y + centerX) * 3);
      const left = centerX - width / 2 + wobble;
      context.fillStyle = DIM;
      context.fillRect(left, y, width, 4);
      context.fillStyle = MUTED;
      context.fillRect(left, y, 1, 4);
    }
  }
  drawRockPoints(context, { color: DARKEST, fromTop: true, baseY: 18, maxLength: 46, seed: 1 });
  drawRockPoints(context, { color: DARKEST, fromTop: false, baseY: 318, maxLength: 40, seed: 4 });
}

function drawServerFarm(context) {
  context.fillStyle = DEEP;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  context.fillStyle = DARKEST;
  context.fillRect(0, 0, SCREEN_WIDTH, 14);
  context.fillStyle = DIM;
  context.fillRect(0, 18, SCREEN_WIDTH, 3);
  const rackWidth = 34;
  for (let rackX = 6; rackX < SCREEN_WIDTH; rackX += rackWidth + 12) {
    context.fillStyle = DIM;
    context.fillRect(rackX, 40, rackWidth, SCREEN_HEIGHT - 40);
    context.fillStyle = MUTED;
    context.fillRect(rackX, 40, rackWidth, 1);
    context.fillRect(rackX, 40, 1, SCREEN_HEIGHT - 40);
    for (let unitY = 50; unitY < SCREEN_HEIGHT; unitY += 10) {
      context.fillStyle = DEEP;
      context.fillRect(rackX + 3, unitY, rackWidth - 6, 1);
      const light = scatter(rackX * 7 + unitY);
      if (light < 0.28) {
        context.fillStyle = light < 0.05 ? BRIGHT_STATUS_LIGHT : STATUS_LIGHT;
        context.fillRect(rackX + rackWidth - 5, unitY + 2, 1, 1);
      }
    }
  }
}
