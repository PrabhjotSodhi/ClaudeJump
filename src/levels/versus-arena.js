export const WATER_LINE_Y = 328;

export const PLATFORM_LAYOUTS = [
  { x: 80, y: 224, width: 144, height: 16 },
  { x: 416, y: 224, width: 144, height: 16 },
  { x: 256, y: 144, width: 128, height: 16 },
];

export const PLAYER_SPAWNS = [
  { id: 'red', color: '#dc2828', spawnX: 152, spawnY: 224, facing: 1 },
  { id: 'blue', color: '#2846dc', spawnX: 488, spawnY: 224, facing: -1 },
];

const SKY_TOP_COLOR = [30, 110, 230];
const SKY_BOTTOM_COLOR = [110, 210, 255];

export function drawBackground(context, screenWidth, screenHeight) {
  for (let y = 0; y < screenHeight; y++) {
    const progress = y / (screenHeight - 1);
    const color = SKY_TOP_COLOR.map((start, index) => Math.round(start + (SKY_BOTTOM_COLOR[index] - start) * progress));
    context.fillStyle = `rgb(${color})`;
    context.fillRect(0, y, screenWidth, 1);
  }
}
