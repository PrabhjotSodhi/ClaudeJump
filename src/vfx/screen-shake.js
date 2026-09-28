// Shakes the game and background layers by whole pixels when big things happen. Display only:
// it listens to events, counts down in ticks, and is never read by game logic. The offset comes
// from the ticks remaining, so the same events always shake the same way.
const BLAST_SHAKE_PIXELS = 4;
const BLAST_SHAKE_TICKS = 12;
const FALL_SHAKE_PIXELS = 3;
const FALL_SHAKE_TICKS = 10;

export class ScreenShake {
  constructor() {
    this.pixels = 0;
    this.totalTicks = 0;
    this.ticksRemaining = 0;
  }

  attach(events) {
    events.on('rocket-exploded', () => this.start(BLAST_SHAKE_PIXELS, BLAST_SHAKE_TICKS));
    events.on('bomb-exploded', () => this.start(BLAST_SHAKE_PIXELS, BLAST_SHAKE_TICKS));
    events.on('player-fell-in-water', () => this.start(FALL_SHAKE_PIXELS, FALL_SHAKE_TICKS));
  }

  // A smaller shake never cuts short a bigger one that is still running.
  start(pixels, ticks) {
    if (this.ticksRemaining > 0 && this.currentPixels() > pixels) return;
    this.pixels = pixels;
    this.totalTicks = ticks;
    this.ticksRemaining = ticks;
  }

  update() {
    if (this.ticksRemaining > 0) this.ticksRemaining--;
  }

  currentPixels() {
    return Math.round((this.pixels * this.ticksRemaining) / this.totalTicks);
  }

  // The picture jumps back and forth each tick and settles as the shake fades.
  get offset() {
    if (this.ticksRemaining <= 0) return { x: 0, y: 0 };
    const pixels = this.currentPixels();
    const direction = this.ticksRemaining % 2 === 0 ? 1 : -1;
    return { x: direction * pixels + 0, y: -direction * Math.round(pixels / 2) + 0 };
  }
}
