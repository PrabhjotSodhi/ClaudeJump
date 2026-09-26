import { Entity } from '../engine/entity.js';

const FILL_COLOR = '#afafb6';
const HIGHLIGHT_COLOR = '#dcdce2';
const SHADOW_COLOR = '#464652';

export class Platform extends Entity {
  constructor({ x, y, width, height }) {
    super();
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  render(context) {
    context.fillStyle = SHADOW_COLOR;
    context.fillRect(this.x, this.y, this.width, this.height);
    context.fillStyle = FILL_COLOR;
    context.fillRect(this.x + 1, this.y + 1, this.width - 2, this.height - 2);
    context.fillStyle = HIGHLIGHT_COLOR;
    context.fillRect(this.x + 1, this.y + 1, this.width - 2, 1);
    context.fillStyle = SHADOW_COLOR;
    const centerY = this.y + Math.floor(this.height / 2);
    context.fillRect(this.x + 3, centerY, 1, 1);
    context.fillRect(this.x + this.width - 4, centerY, 1, 1);
  }
}
