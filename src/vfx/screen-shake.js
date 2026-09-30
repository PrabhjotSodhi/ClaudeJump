// Shakes the game and background layers by whole pixels when big things happen. Display only:
// it listens to events, counts down in ticks, and is never read by game logic. The offset comes
// from the ticks remaining, so the same events always shake the same way.
// A hit with a direction kicks the picture that way and settles back. A shake with no direction,
// like a blast or a fall in the sea, jumps back and forth as it fades.
import { IMPACT_EFFECTS } from '../engine/config.js';

const FALL_SHAKE_PIXELS = 3;
const FALL_SHAKE_TICKS = 10;
const COUNT_SHAKE = { pixels: 2, ticks: 6 };
const GO_SHAKE = { pixels: 3, ticks: 10 };

export class ScreenShake {
  constructor() {
    this.pixels = 0;
    this.totalTicks = 0;
    this.ticksRemaining = 0;
    this.directionX = 0;
    this.directionY = 0;
  }

  attach(events) {
    const startHit = ({ strength = 'light', directionX = 0, directionY = 0 }) => {
      const { shakePixels, shakeTicks } = IMPACT_EFFECTS[strength];
      this.start(shakePixels, shakeTicks, directionX, directionY);
    };
    events.on('rocket-exploded', startHit);
    events.on('bomb-exploded', startHit);
    events.on('player-shoved', startHit);
    events.on('trap-sprung', startHit);
    events.on('player-pinched', startHit);
    events.on('dash-hit', startHit);
    events.on('player-fell-in-water', () => this.start(FALL_SHAKE_PIXELS, FALL_SHAKE_TICKS));
    events.on('countdown-beat', ({ count }) => {
      const { pixels, ticks } = count === 0 ? GO_SHAKE : COUNT_SHAKE;
      this.start(pixels, ticks);
    });
  }

  // A smaller shake never cuts short a bigger one that is still running.
  start(pixels, ticks, directionX = 0, directionY = 0) {
    if (this.ticksRemaining > 0 && this.currentPixels() > pixels) return;
    this.pixels = pixels;
    this.totalTicks = ticks;
    this.ticksRemaining = ticks;
    this.directionX = Math.sign(directionX);
    this.directionY = Math.sign(directionY);
  }

  update() {
    if (this.ticksRemaining > 0) this.ticksRemaining--;
  }

  currentPixels() {
    return Math.round((this.pixels * this.ticksRemaining) / this.totalTicks);
  }

  get offset() {
    if (this.ticksRemaining <= 0) return { x: 0, y: 0 };
    const pixels = this.currentPixels();
    if (this.directionX !== 0 || this.directionY !== 0) {
      return { x: this.directionX * pixels + 0, y: this.directionY * pixels + 0 };
    }
    const direction = this.ticksRemaining % 2 === 0 ? 1 : -1;
    return { x: direction * pixels + 0, y: -direction * Math.round(pixels / 2) + 0 };
  }
}
