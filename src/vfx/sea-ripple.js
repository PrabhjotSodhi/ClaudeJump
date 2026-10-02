import { SEA_COLUMN_COUNT, SEA_COLUMN_WIDTH, SPLASH_TIERS } from '../engine/config.js';

// A damped wave along the sea surface, one height per column of SEA_COLUMN_WIDTH pixels. Display
// only: it listens to events, steps once per tick, and is never read by game logic. Positive
// heights push the surface down. The shader reads the heights as pixel offsets.
const SPLASH_SPREAD_COLUMNS = 2;
const WAVE_STIFFNESS = 0.4;
const WAVE_DAMPING = 0.99;
// Without a pull toward flat, the average height of the sea would never come back.
const FLATTEN_PULL = 0.02;
const SETTLE_THRESHOLD = 0.02;
// One byte per column in the shader texture, so heights are clamped to this many pixels either way.
export const MAX_RIPPLE_HEIGHT = 12;

export class SeaRipple {
  constructor() {
    this.heights = new Float32Array(SEA_COLUMN_COUNT);
    this.speeds = new Float32Array(SEA_COLUMN_COUNT);
  }

  attach(events, getPlayers) {
    events.on('player-fell-in-water', ({ playerId, splashTier = 'small' }) => {
      const player = getPlayers().find((candidate) => candidate.id === playerId);
      if (player) this.splash(player.x + player.width / 2, splashTier);
    });
  }

  attachCrates(events) {
    events.on('crate-fell-in-water', ({ x }) => this.splash(x));
  }

  // The surface dips at x, then the dip spreads out both ways as ripples.
  splash(x, splashTier = 'small') {
    const impulse = SPLASH_TIERS[splashTier].rippleImpulse;
    const centerColumn = Math.min(SEA_COLUMN_COUNT - 1, Math.max(0, Math.floor(x / SEA_COLUMN_WIDTH)));
    for (let offset = -SPLASH_SPREAD_COLUMNS; offset <= SPLASH_SPREAD_COLUMNS; offset++) {
      const column = centerColumn + offset;
      if (column < 0 || column >= SEA_COLUMN_COUNT) continue;
      this.speeds[column] += impulse / (1 + Math.abs(offset));
    }
  }

  update() {
    const last = SEA_COLUMN_COUNT - 1;
    for (let column = 0; column <= last; column++) {
      const left = this.heights[Math.max(0, column - 1)];
      const right = this.heights[Math.min(last, column + 1)];
      this.speeds[column] =
        (this.speeds[column] +
          (left + right - 2 * this.heights[column]) * WAVE_STIFFNESS -
          this.heights[column] * FLATTEN_PULL) *
        WAVE_DAMPING;
    }
    for (let column = 0; column <= last; column++) {
      this.heights[column] = Math.max(
        -MAX_RIPPLE_HEIGHT,
        Math.min(MAX_RIPPLE_HEIGHT, this.heights[column] + this.speeds[column]),
      );
      if (Math.abs(this.heights[column]) < SETTLE_THRESHOLD && Math.abs(this.speeds[column]) < SETTLE_THRESHOLD) {
        this.heights[column] = 0;
        this.speeds[column] = 0;
      }
    }
  }

  // Bytes for the shader texture: 128 is flat, each step is one pixel.
  toBytes() {
    const bytes = new Uint8Array(SEA_COLUMN_COUNT * 4);
    for (let column = 0; column < SEA_COLUMN_COUNT; column++) {
      const value = 128 + Math.round(this.heights[column]);
      bytes.fill(value, column * 4, column * 4 + 3);
      bytes[column * 4 + 3] = 255;
    }
    return bytes;
  }
}
