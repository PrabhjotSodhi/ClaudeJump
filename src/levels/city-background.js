import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';

export const SKY_COLOR = '#5a6988';
export const FAR_COLOR = '#3a4466';
export const MID_COLOR = '#3a4466';
export const NEAR_COLOR = '#262b44';
export const NEAR_RIM_COLOR = '#3a4466';
export const WINDOW_COLOR = '#8b9bb4';
// Each building is [x, top, width] and runs down to the bottom of the screen.
export const FAR_BUILDINGS = [
  [0, 190, 40],
  [40, 150, 18],
  [62, 176, 50],
  [120, 134, 10],
  [140, 196, 60],
  [210, 118, 22],
  [240, 170, 44],
  [300, 188, 70],
  [382, 140, 12],
  [410, 176, 56],
  [472, 124, 24],
  [500, 162, 40],
  [548, 184, 50],
  [602, 146, 20],
  [622, 180, 18],
];
export const MID_BUILDINGS = [
  [0, 212, 64],
  [70, 184, 30],
  [110, 232, 80],
  [196, 200, 36],
  [250, 236, 70],
  [330, 190, 40],
  [380, 226, 90],
  [480, 196, 36],
  [520, 230, 60],
  [584, 204, 56],
];
// Sawtooth factory roofs: [x, base y, tooth count].
export const MID_ROOFS = [
  [110, 232, 8],
  [380, 226, 9],
];
export const ROOF_TOOTH = { width: 10, height: 6 };
// Scaffold towers: [x, top, width, bottom], braced every SCAFFOLD_BAY_HEIGHT rows.
export const MID_SCAFFOLDS = [
  [150, 150, 24, 232],
  [436, 156, 22, 226],
];
export const SCAFFOLD_BAY_HEIGHT = 12;
// Pipes: [left x, right x, top y].
export const MID_PIPES = [
  [96, 200, 206],
  [230, 332, 214],
  [458, 484, 208],
];
export const PIPE_HEIGHT = 3;
export const MID_WINDOWS = [
  [78, 196, 2, 3],
  [86, 210, 2, 3],
  [206, 214, 2, 3],
  [340, 204, 2, 3],
  [490, 212, 2, 3],
];
export const NEAR_BUILDINGS = [
  [0, 160, 28],
  [28, 262, 60],
  [96, 278, 70],
  [170, 252, 40],
  [216, 286, 90],
  [310, 262, 50],
  [364, 290, 80],
  [448, 258, 44],
  [496, 280, 70],
  [572, 236, 30],
  [604, 176, 36],
];
export const NEAR_WINDOWS = [
  [8, 176, 3, 4],
  [16, 200, 3, 4],
  [182, 266, 3, 4],
  [458, 272, 3, 4],
  [614, 190, 3, 4],
  [622, 220, 3, 4],
];
// Mist bands: [top y, bottom y, color]. The top half of a band is sparser than the bottom half.
export const MIST_BANDS_OVER_MID = [[232, 268, SKY_COLOR]];
export const MIST_BANDS_OVER_NEAR = [[300, SCREEN_HEIGHT, FAR_COLOR]];

// Half fills every other pixel in a checkerboard, quarter fills one pixel in four.
function fillDither(context, left, top, width, height, color, density) {
  context.fillStyle = color;
  for (let y = top; y < top + height; y++) {
    for (let x = left; x < left + width; x++) {
      const filled = density === 'half' ? (x + y) % 2 === 0 : x % 2 === 0 && y % 2 === 0;
      if (filled) context.fillRect(x, y, 1, 1);
    }
  }
}

function drawMist(context, bands) {
  for (const [top, bottom, color] of bands) {
    const middle = Math.floor((top + bottom) / 2);
    fillDither(context, 0, top, SCREEN_WIDTH, middle - top, color, 'quarter');
    fillDither(context, 0, middle, SCREEN_WIDTH, bottom - middle, color, 'half');
  }
}

function fillBuildings(context, buildings, color) {
  context.fillStyle = color;
  for (const [x, top, width] of buildings) context.fillRect(x, top, width, SCREEN_HEIGHT - top);
}

function fillRects(context, rects, color) {
  context.fillStyle = color;
  for (const [x, y, width, height] of rects) context.fillRect(x, y, width, height);
}

function drawLine(context, fromX, fromY, toX, toY) {
  const steps = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));
  for (let step = 0; step <= steps; step++) {
    const x = Math.round(fromX + ((toX - fromX) * step) / steps);
    const y = Math.round(fromY + ((toY - fromY) * step) / steps);
    context.fillRect(x, y, 1, 1);
  }
}

function drawScaffold(context, [left, top, width, bottom]) {
  const right = left + width - 1;
  context.fillRect(left, top, 1, bottom - top);
  context.fillRect(right, top, 1, bottom - top);
  for (let y = top; y + SCAFFOLD_BAY_HEIGHT <= bottom; y += SCAFFOLD_BAY_HEIGHT) {
    context.fillRect(left, y, width, 1);
    drawLine(context, left, y, right, y + SCAFFOLD_BAY_HEIGHT);
  }
}

function drawSawtoothRoof(context, [left, baseY, toothCount]) {
  for (let column = 0; column < toothCount * ROOF_TOOTH.width; column++) {
    const height = ROOF_TOOTH.height - Math.floor(((column % ROOF_TOOTH.width) * ROOF_TOOTH.height) / ROOF_TOOTH.width);
    context.fillRect(left + column, baseY - height, 1, height);
  }
}

// Three layers of city and factory, lightest and mistiest at the back. Far is a dither over the sky.
export function drawCityBackground(context) {
  context.fillStyle = SKY_COLOR;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  for (const [x, top, width] of FAR_BUILDINGS)
    fillDither(context, x, top, width, SCREEN_HEIGHT - top, FAR_COLOR, 'half');

  fillBuildings(context, MID_BUILDINGS, MID_COLOR);
  for (const roof of MID_ROOFS) drawSawtoothRoof(context, roof);
  for (const scaffold of MID_SCAFFOLDS) drawScaffold(context, scaffold);
  for (const [left, right, top] of MID_PIPES) context.fillRect(left, top, right - left, PIPE_HEIGHT);
  fillRects(context, MID_WINDOWS, WINDOW_COLOR);
  drawMist(context, MIST_BANDS_OVER_MID);

  fillBuildings(context, NEAR_BUILDINGS, NEAR_COLOR);
  context.fillStyle = NEAR_RIM_COLOR;
  for (const [x, top, width] of NEAR_BUILDINGS) context.fillRect(x, top, width, 1);
  fillRects(context, NEAR_WINDOWS, WINDOW_COLOR);
  drawMist(context, MIST_BANDS_OVER_NEAR);
}
