export const WATER_LINE_Y = 164;

export const PLATFORM_LAYOUTS = [
  { x: 40, y: 112, width: 72, height: 8 },
  { x: 208, y: 112, width: 72, height: 8 },
  { x: 128, y: 72, width: 64, height: 8 },
];

export const PLAYER_SPAWNS = [
  { id: 'red', color: '#dc2828', spawnX: 76, spawnY: 112, facing: 1 },
  { id: 'blue', color: '#2846dc', spawnX: 244, spawnY: 112, facing: -1 },
];

const SKY_TOP_COLOR = [30, 110, 230];
const SKY_BOTTOM_COLOR = [110, 210, 255];

export function drawBackground(context, screenWidth, screenHeight) {
  for (let y = 0; y < screenHeight; y++) {
    const t = y / (screenHeight - 1);
    const color = SKY_TOP_COLOR.map((start, index) => Math.round(start + (SKY_BOTTOM_COLOR[index] - start) * t));
    context.fillStyle = `rgb(${color})`;
    context.fillRect(0, y, screenWidth, 1);
  }
}
