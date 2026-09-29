export const PLAYERS = [
  { id: 'red', color: '#dc2828' },
  { id: 'blue', color: '#2846dc' },
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
