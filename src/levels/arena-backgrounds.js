import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { SeededRandom } from '../engine/seeded-random.js';

const MIST_BAND_HEIGHT = 12;
const CONTAINER_HEIGHT = 14;
const BRIDGE_LAYERS = [
  { color: '#8b9bb4', firstTowerX: 70, spacing: 230, top: 90, halfSpan: 12, legWidth: 5, sag: 70, density: 'quarter' },
  { color: '#3a4466', firstTowerX: 160, spacing: 210, top: 130, halfSpan: 14, legWidth: 6, sag: 60, density: 'half' },
  { color: '#262b44', firstTowerX: 30, spacing: 300, top: 170, halfSpan: 18, legWidth: 8, sag: 50, density: 'half' },
];
const BRIDGE_TOWER_BOTTOM_Y = 300;
const TOWER_LAYERS = [
  { color: '#3a4466', towerXs: [90, 300, 520], top: 120, baseHalfWidth: 26 },
  { color: '#262b44', towerXs: [10, 190, 410, 610], top: 170, baseHalfWidth: 30 },
];
const TOWER_BOTTOM_Y = 300;
const STEAM_PUFF_COUNT = 9;

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

// A bridge tower is two legs joined by a crossbeam near the top and another halfway down.
function drawBridgeTower(context, { color, density }, centerX, top, halfSpan, legWidth) {
  const height = BRIDGE_TOWER_BOTTOM_Y - top;
  for (const legX of [centerX - halfSpan - legWidth, centerX + halfSpan]) {
    fillDither(context, color, legX, top, legWidth, height, density);
  }
  for (const beamY of [top + 12, top + Math.round(height / 2)]) {
    fillDither(context, color, centerX - halfSpan, beamY, halfSpan * 2, 4, density);
  }
}

// A cable sags between two tower tops, lowest halfway between them.
function drawBridgeCable(context, color, startX, endX, top, sag) {
  const halfWidth = (endX - startX) / 2;
  for (let x = startX; x <= endX; x++) {
    const offset = (x - startX - halfWidth) / halfWidth;
    fillRect(context, color, x, top + Math.round(sag * (1 - offset * offset)), 1, 1);
  }
}

function drawBridge(context) {
  fillRect(context, '#5a6988', 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  fillDither(context, '#8b9bb4', 0, 210, SCREEN_WIDTH, 90, 'quarter');
  BRIDGE_LAYERS.forEach((layer, layerIndex) => {
    const { color, firstTowerX, spacing, top, halfSpan, legWidth, sag } = layer;
    for (let towerX = firstTowerX - spacing; towerX < SCREEN_WIDTH + spacing; towerX += spacing) {
      drawBridgeTower(context, layer, towerX, top, halfSpan, legWidth);
      drawBridgeCable(context, color, towerX, towerX + spacing, top, sag);
    }
    drawMistBand(context, 230 + layerIndex * 20, '#5a6988');
  });
  fillRect(context, '#181425', 0, BRIDGE_TOWER_BOTTOM_Y, SCREEN_WIDTH, SCREEN_HEIGHT - BRIDGE_TOWER_BOTTOM_Y);
}

// A cooling tower narrows towards its waist, then flares at the rim.
function drawCoolingTower(context, color, centerX, top, baseHalfWidth) {
  const height = TOWER_BOTTOM_Y - top;
  for (let y = top; y < TOWER_BOTTOM_Y; y++) {
    const halfWidth = baseHalfWidth - Math.round(baseHalfWidth * 0.3 * Math.sin(((y - top) / height) * Math.PI));
    fillDither(context, color, centerX - halfWidth, y, halfWidth * 2, 1);
  }
}

// A plume of dithered puffs that drifts up and to one side from a tower rim and thins as it rises.
function drawSteamPlume(context, color, centerX, rimY, random) {
  for (let puff = 0; puff < STEAM_PUFF_COUNT; puff++) {
    const width = 14 + puff * 3 + Math.floor(random.next() * 6);
    const x = centerX - width / 2 + puff * 4 + Math.floor(random.next() * 6);
    fillDither(context, color, x, rimY - 8 - puff * 9, width, 8, puff < 4 ? 'half' : 'quarter');
  }
}

function drawCoolingTowers(context, random) {
  fillRect(context, '#5a6988', 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  fillDither(context, '#8b9bb4', 0, 200, SCREEN_WIDTH, 100, 'quarter');
  TOWER_LAYERS.forEach(({ color, towerXs, top, baseHalfWidth }, layerIndex) => {
    for (const towerX of towerXs) {
      drawCoolingTower(context, color, towerX, top, baseHalfWidth);
      if (layerIndex === 0) drawSteamPlume(context, '#3a4466', towerX, top, random);
    }
    drawMistBand(context, 250 + layerIndex * 16, '#5a6988');
  });
  fillRect(context, '#181425', 0, TOWER_BOTTOM_Y, SCREEN_WIDTH, SCREEN_HEIGHT - TOWER_BOTTOM_Y);
  for (let x = 20; x < SCREEN_WIDTH; x += 70) {
    fillRect(context, '#181425', x, 284, 10, 16);
    fillRect(context, '#181425', x + 4, 272, 2, 12);
    if (random.next() < 0.5) fillRect(context, '#feae34', x + 3, 290, 2, 2);
  }
}

const DRAW_BY_BACKGROUND_NAME = {
  harbor: drawHarbor,
  cave: drawCave,
  rooftops: drawRooftops,
  'server-farm': drawServerFarm,
  bridge: drawBridge,
  'cooling-towers': drawCoolingTowers,
};

// Each arena draws the same picture every time, from its own fixed seed.
export function drawArenaBackground(context, backgroundName) {
  const draw = DRAW_BY_BACKGROUND_NAME[backgroundName];
  if (!draw) throw new Error(`No background named ${backgroundName}`);
  draw(context, new SeededRandom(backgroundName.length * 97));
}
