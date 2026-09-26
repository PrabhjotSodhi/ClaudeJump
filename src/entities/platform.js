import { Entity } from '../engine/entity.js';

const FILL_COLOR = '#afafb6';
const HIGHLIGHT_COLOR = '#dcdce2';
const SHADOW_COLOR = '#464652';
const FIRE_FILL_COLOR = '#d85830';
const ICE_FILL_COLOR = '#bcdcf0';

// How long a platform stays on fire, and how often it pops players standing on it while burning.
const FIRE_DURATION_TICKS = 180; // 3 seconds
const FIRE_POP_INTERVAL_TICKS = 30; // half a second
// How long a platform stays icy.
const ICE_DURATION_TICKS = 300; // 5 seconds

// A platform can carry one timed effect at a time, such as fire or ice. Each effect is a plain
// object with a `type`, and setting a new one replaces whatever was there, so ice on a burning
// platform puts the fire out and the reverse.
export class Platform extends Entity {
  constructor(config) {
    super(config);
    this.effect = null;
  }

  get isBurning() {
    return this.effect?.type === 'fire';
  }

  get isIcy() {
    return this.effect?.type === 'ice';
  }

  igniteWithFire() {
    this.effect = { type: 'fire', ticksBurning: 0 };
  }

  freezeWithIce() {
    this.effect = { type: 'ice', ticksFrozen: 0 };
  }

  clearEffect() {
    this.effect = null;
  }

  // Advances the platform's timed effect by one tick. Returns true on a tick players standing on
  // the platform should be popped.
  update() {
    if (this.isBurning) {
      this.effect.ticksBurning++;
      if (this.effect.ticksBurning >= FIRE_DURATION_TICKS) {
        this.clearEffect();
        return false;
      }
      return this.effect.ticksBurning % FIRE_POP_INTERVAL_TICKS === 0;
    }

    if (this.isIcy) {
      this.effect.ticksFrozen++;
      if (this.effect.ticksFrozen >= ICE_DURATION_TICKS) this.clearEffect();
    }
    return false;
  }

  render(context) {
    context.fillStyle = SHADOW_COLOR;
    context.fillRect(this.x, this.y, this.width, this.height);
    context.fillStyle = this.isBurning ? FIRE_FILL_COLOR : this.isIcy ? ICE_FILL_COLOR : FILL_COLOR;
    context.fillRect(this.x + 1, this.y + 1, this.width - 2, this.height - 2);
    context.fillStyle = HIGHLIGHT_COLOR;
    context.fillRect(this.x + 1, this.y + 1, this.width - 2, 1);
    context.fillStyle = SHADOW_COLOR;
    const centerY = this.y + Math.floor(this.height / 2);
    context.fillRect(this.x + 3, centerY, 1, 1);
    context.fillRect(this.x + this.width - 4, centerY, 1, 1);
  }
}
