import { Entity } from '../engine/entity.js';

const FILL_COLOR = '#afafb6';
const HIGHLIGHT_COLOR = '#dcdce2';
const SHADOW_COLOR = '#464652';
const FIRE_FILL_COLOR = '#d85830';

// How long a platform stays on fire, and how often it pops players standing on it while burning.
const FIRE_DURATION_TICKS = 180; // 3 seconds
const FIRE_POP_INTERVAL_TICKS = 30; // half a second

// A platform can carry one timed effect at a time, such as fire. Each effect is a plain object
// with a `type` so a later effect (Ice Floor) can sit beside fire's here without a rewrite.
export class Platform extends Entity {
  constructor(config) {
    super(config);
    this.effect = null;
  }

  get isBurning() {
    return this.effect?.type === 'fire';
  }

  igniteWithFire() {
    this.effect = { type: 'fire', ticksBurning: 0 };
  }

  clearEffect() {
    this.effect = null;
  }

  // Advances the platform's timed effect by one tick. Returns true on a tick players standing on
  // the platform should be popped.
  update() {
    if (!this.isBurning) return false;

    this.effect.ticksBurning++;
    if (this.effect.ticksBurning >= FIRE_DURATION_TICKS) {
      this.clearEffect();
      return false;
    }
    return this.effect.ticksBurning % FIRE_POP_INTERVAL_TICKS === 0;
  }

  render(context) {
    context.fillStyle = SHADOW_COLOR;
    context.fillRect(this.x, this.y, this.width, this.height);
    context.fillStyle = this.isBurning ? FIRE_FILL_COLOR : FILL_COLOR;
    context.fillRect(this.x + 1, this.y + 1, this.width - 2, this.height - 2);
    context.fillStyle = HIGHLIGHT_COLOR;
    context.fillRect(this.x + 1, this.y + 1, this.width - 2, 1);
    context.fillStyle = SHADOW_COLOR;
    const centerY = this.y + Math.floor(this.height / 2);
    context.fillRect(this.x + 3, centerY, 1, 1);
    context.fillRect(this.x + this.width - 4, centerY, 1, 1);
  }
}
