import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { SeededRandom } from '../engine/seeded-random.js';

const MIST_BAND_HEIGHT = 12;
const CONTAINER_HEIGHT = 14;

function fillRect(context, color, x, y, width, height) {
  context.fillStyle = color;
  context.fillRect(x, y, width, height);
}

// 'half' is a checkerboard, 'quarter' fills one pixel in four.
function fillDither(context, color, x, y, width, height, density = 'half') {
  context.fillStyle = color;
  for (let row = y; row < y + height; row++) {
    for (let column = x; column < x + width; column++) {
      const filled = density === 'half' ? (column + row) % 2 === 0 : column % 2 === 0 && row % 2 === 0;
      if (filled) context.fillRect(column, row, 1, 1);
    }
  }
}

function drawMistBand(context, top, color) {
  fillDither(context, color, 0, top, SCREEN_WIDTH, MIST_BAND_HEIGHT, 'quarter');
  fillDither(context, color, 0, top + MIST_BAND_HEIGHT, SCREEN_WIDTH, MIST_BAND_HEIGHT);
}

// A spike that narrows from baseWidth to a point. direction 1 grows down from baseY, -1 grows up.
function fillSpike(context, color, centerX, baseY, baseWidth, length, direction) {
  context.fillStyle = color;
  for (let step = 0; step < length; step++) {
    const halfWidth = Math.round((baseWidth / 2) * (1 - step / length));
    context.fillRect(centerX - halfWidth, baseY + step * direction, halfWidth * 2 + 1, 1);
  }
}

// A shipping container: a body, vertical ribs and a dark base line.
function drawContainer(context, x, y, width, bodyColor, ribColor) {
  fillRect(context, bodyColor, x, y, width, CONTAINER_HEIGHT);
  for (let ribX = x + 2; ribX < x + width - 1; ribX += 3)
    fillRect(context, ribColor, ribX, y + 2, 1, CONTAINER_HEIGHT - 4);
  fillRect(context, ribColor, x, y + CONTAINER_HEIGHT - 1, width, 1);
}

function drawHarbor(context, random) {
  fillRect(context, '#5a6988', 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  fillDither(context, '#3a4466', 0, 236, SCREEN_WIDTH, SCREEN_HEIGHT - 236);
  for (const craneX of [60, 250, 470]) {
    fillDither(context, '#3a4466', craneX, 90, 6, 150);
    fillDither(context, '#3a4466', craneX - 30, 90, 110, 6);
    fillRect(context, '#3a4466', craneX + 70, 96, 1, 34);
    fillRect(context, '#3a4466', craneX + 67, 130, 7, 4);
  }
  for (let x = 4; x < SCREEN_WIDTH; x += 52) {
    const stackHeight = 1 + Math.floor(random.next() * 3);
    for (let index = 0; index < stackHeight; index++)
      drawContainer(context, x + (index % 2) * 6, 272 - index * CONTAINER_HEIGHT, 44, '#3a4466', '#262b44');
  }
  for (let x = 30; x < SCREEN_WIDTH; x += 96) {
    const stackHeight = 1 + Math.floor(random.next() * 2);
    for (let index = 0; index < stackHeight; index++)
      drawContainer(context, x, 282 - index * CONTAINER_HEIGHT, 44, '#262b44', '#181425');
  }
  fillDither(context, '#5a6988', 0, 290, SCREEN_WIDTH, 6, 'quarter');
  fillRect(context, '#262b44', 0, 296, SCREEN_WIDTH, 4);
  fillRect(context, '#3a4466', 0, 296, SCREEN_WIDTH, 1);
  fillRect(context, '#262b44', 380, 280, 220, 50);
  fillRect(context, '#262b44', 420, 250, 50, 30);
  fillRect(context, '#3a4466', 380, 280, 220, 1);
  for (let x = 10; x < SCREEN_WIDTH; x += 58) fillRect(context, '#181425', x, 300, 6, 30);
}

function drawCave(context, random) {
  fillRect(context, '#262b44', 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  for (let index = 0; index < 40; index++) {
    const x = Math.floor(random.next() * SCREEN_WIDTH);
    const y = Math.floor(random.next() * SCREEN_HEIGHT);
    fillDither(context, '#3a4466', x, y, 20 + Math.floor(random.next() * 40), 10 + Math.floor(random.next() * 20));
  }
  for (let x = 0; x < SCREEN_WIDTH; x += 12 + Math.floor(random.next() * 18)) {
    const length = 20 + Math.floor(random.next() * 60);
    fillSpike(context, '#181425', x, 0, 10 + Math.floor(random.next() * 14), length, 1);
  }
  for (let x = 0; x < SCREEN_WIDTH; x += 20 + Math.floor(random.next() * 30)) {
    const length = 30 + Math.floor(random.next() * 70);
    fillSpike(context, '#181425', x, SCREEN_HEIGHT - 1, 16 + Math.floor(random.next() * 20), length, -1);
  }
  for (const [x, y] of [
    [90, 60],
    [300, 40],
    [520, 70],
    [180, 300],
    [600, 290],
  ]) {
    fillRect(context, '#124e89', x, y, 3, 6);
    fillRect(context, '#0099db', x + 1, y + 1, 1, 3);
  }
  drawMistBand(context, 270, '#3a4466');
}

function drawRooftops(context, random) {
  fillRect(context, '#3a4466', 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  fillDither(context, '#5a6988', 0, 140, SCREEN_WIDTH, 60, 'quarter');
  for (let x = 0; x < SCREEN_WIDTH; x += 24) {
    const top = 120 + Math.floor(random.next() * 80);
    fillDither(context, '#262b44', x, top, 20, SCREEN_HEIGHT - top);
  }
  for (let x = -10; x < SCREEN_WIDTH; x += 58) {
    const top = 150 + Math.floor(random.next() * 70);
    fillRect(context, '#262b44', x, top, 48, SCREEN_HEIGHT);
    if (random.next() < 0.4) fillRect(context, '#262b44', x + 22, top - 24, 2, 24);
    if (random.next() < 0.3) {
      fillRect(context, '#262b44', x + 8, top - 14, 14, 10);
      fillRect(context, '#262b44', x + 10, top - 4, 2, 4);
      fillRect(context, '#262b44', x + 18, top - 4, 2, 4);
    }
    for (let y = top + 8; y < SCREEN_HEIGHT; y += 12) {
      for (let windowX = x + 6; windowX < x + 44; windowX += 10) {
        if (random.next() < 0.12) fillRect(context, '#feae34', windowX, y, 3, 4);
      }
    }
  }
  drawMistBand(context, 270, '#3a4466');
  fillRect(context, '#181425', 0, 300, SCREEN_WIDTH, SCREEN_HEIGHT - 300);
  for (let x = 30; x < SCREEN_WIDTH; x += 110) {
    fillRect(context, '#181425', x, 288, 16, 12);
    fillRect(context, '#181425', x + 60, 276, 4, 24);
  }
}

function drawServerFarm(context, random) {
  fillRect(context, '#3a4466', 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  const coolingTowerXs = [40, 200, 420, 560];
  for (const towerX of coolingTowerXs) {
    for (let y = 110; y < SCREEN_HEIGHT; y++) {
      const halfWidth = 22 - Math.round(8 * Math.sin(((y - 110) / 250) * Math.PI));
      fillDither(context, '#262b44', towerX - halfWidth, y, halfWidth * 2, 1);
    }
    fillDither(context, '#5a6988', towerX - 20, 80, 40, 30, 'quarter');
  }
  for (let x = 0; x < SCREEN_WIDTH; x += 110) {
    const top = 210 + Math.floor(random.next() * 20);
    fillRect(context, '#262b44', x, top, 100, SCREEN_HEIGHT);
    fillRect(context, '#3a4466', x, top, 100, 1);
    for (let y = top + 8; y < SCREEN_HEIGHT; y += 8) {
      for (let lightX = x + 6; lightX < x + 96; lightX += 6) {
        if (random.next() < 0.1) fillRect(context, random.next() < 0.5 ? '#0099db' : '#124e89', lightX, y, 1, 1);
      }
    }
  }
  drawMistBand(context, 280, '#3a4466');
  fillRect(context, '#181425', 0, 312, SCREEN_WIDTH, SCREEN_HEIGHT - 312);
  for (let x = 0; x < SCREEN_WIDTH; x += 40) fillRect(context, '#181425', x, 292, 3, 20);
  fillRect(context, '#181425', 0, 296, SCREEN_WIDTH, 1);
}

const DRAW_BY_BACKGROUND_NAME = {
  harbor: drawHarbor,
  cave: drawCave,
  rooftops: drawRooftops,
  'server-farm': drawServerFarm,
};

// Each arena draws the same picture every time, from its own fixed seed.
export function drawArenaBackground(context, backgroundName) {
  const draw = DRAW_BY_BACKGROUND_NAME[backgroundName];
  if (!draw) throw new Error(`No background named ${backgroundName}`);
  draw(context, new SeededRandom(backgroundName.length * 97));
}
