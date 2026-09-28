import { Entity } from '../engine/entity.js';

const FILL_COLOR = '#afafb6';
const HIGHLIGHT_COLOR = '#dcdce2';
const SHADOW_COLOR = '#464652';

export class Platform extends Entity {
  render(context) {
    context.fillStyle = SHADOW_COLOR;
    context.fillRect(this.x, this.y, this.width, this.height);
    context.fillStyle = FILL_COLOR;
    context.fillRect(this.x + 2, this.y + 2, this.width - 4, this.height - 4);
    context.fillStyle = HIGHLIGHT_COLOR;
    context.fillRect(this.x + 2, this.y + 2, this.width - 4, 2);
    context.fillStyle = SHADOW_COLOR;
    const centerY = this.y + Math.floor(this.height / 2);
    context.fillRect(this.x + 6, centerY, 2, 2);
    context.fillRect(this.x + this.width - 8, centerY, 2, 2);
  }
}
