import { PhysicsEntity } from '../engine/physics-entity.js';

export const CRAB_WIDTH = 20;
export const CRAB_HEIGHT = 12;
export const CRAB_SPEED = 0.6;

const COLORS = { o: '#3e2731', r: '#a22633', R: '#e43b44', w: '#ffffff' };
const SPRITE_ROWS = [
  '.oo..............oo.',
  'oRRo............oRRo',
  'oRRo..ww....ww..oRRo',
  '.oRo..ww....ww..oRo.',
  '..oooooooooooooooo..',
  '.oRRRRRRRRRRRRRRRRo.',
  '.oRRRRRRRRRRRRRRRRo.',
  '.orrrrrrrrrrrrrrrro.',
  '.orrrrrrrrrrrrrrrro.',
  '..oooooooooooooooo..',
  '...o..o......o..o...',
  '...o..o......o..o...',
];

// A crab walks back and forth along the run it stands on. minX and maxX are the furthest left edge of
// the crab that still keeps it on the run.
export class Crab extends PhysicsEntity {
  constructor({ x, y, minX, maxX, direction }) {
    super({ x, y, width: CRAB_WIDTH, height: CRAB_HEIGHT });
    this.minX = minX;
    this.maxX = maxX;
    this.velocityX = CRAB_SPEED * direction;
  }

  update() {
    const nextX = this.x + this.velocityX;
    if (nextX < this.minX || nextX > this.maxX) {
      this.velocityX = -this.velocityX;
      return;
    }
    this.x = nextX;
  }

  render(context) {
    const drawX = Math.round(this.x);
    const drawY = Math.round(this.y);
    SPRITE_ROWS.forEach((row, rowIndex) => {
      for (let column = 0; column < row.length; column++) {
        const color = COLORS[row[column]];
        if (!color) continue;
        context.fillStyle = color;
        context.fillRect(drawX + column, drawY + rowIndex, 1, 1);
      }
    });
  }
}
