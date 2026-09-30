import { SCREEN_WIDTH } from '../engine/config.js';
import { SeededRandom } from '../engine/seeded-random.js';

const CONFETTI_SEED = 11;
const RAIN_TICKS = 300;
const PIECES_PER_TICK = 2;
const FALL_SPEED_MIN = 0.6;
const FALL_SPEED_RANGE = 0.8;
const SWAY_PIXELS = 3;
const SWAY_PERIOD_TICKS = 40;
// A piece turns over this often, showing its thin edge and then its face.
const FLIP_TICKS = 6;
const LIFETIME_TICKS = 420;
// One piece in this many is white, so the player color sparkles.
const WHITE_EVERY = 4;
const WHITE_COLOR = '#ffffff';

// Display only: rains confetti in the winner's player color when a match is won. Game logic never reads it.
export class Confetti {
  constructor() {
    this.random = new SeededRandom(CONFETTI_SEED);
    this.pieces = [];
    this.color = null;
    this.rainTicksRemaining = 0;
    this.spawnCount = 0;
  }

  attach(events, getPlayers) {
    events.on('match-won', ({ playerId }) => {
      const winner = getPlayers().find((player) => player.id === playerId);
      if (!winner) return;
      this.color = winner.outlineColor ?? winner.color;
      this.rainTicksRemaining = RAIN_TICKS;
    });
    events.on('match-started', () => {
      this.pieces = [];
      this.rainTicksRemaining = 0;
    });
  }

  update() {
    if (this.rainTicksRemaining > 0) {
      this.rainTicksRemaining--;
      for (let index = 0; index < PIECES_PER_TICK; index++) this.addPiece();
    }
    for (const piece of this.pieces) {
      piece.age++;
      piece.y += piece.fallSpeed;
    }
    this.pieces = this.pieces.filter((piece) => piece.age < LIFETIME_TICKS);
  }

  addPiece() {
    this.spawnCount++;
    this.pieces.push({
      x: this.random.next() * SCREEN_WIDTH,
      y: -4 - this.random.next() * 20,
      fallSpeed: FALL_SPEED_MIN + this.random.next() * FALL_SPEED_RANGE,
      swayOffsetTicks: Math.floor(this.random.next() * SWAY_PERIOD_TICKS),
      color: this.spawnCount % WHITE_EVERY === 0 ? WHITE_COLOR : this.color,
      age: 0,
    });
  }

  render(context) {
    for (const piece of this.pieces) {
      const swayPhase = ((piece.age + piece.swayOffsetTicks) % SWAY_PERIOD_TICKS) / SWAY_PERIOD_TICKS;
      const sway = Math.round(Math.sin(swayPhase * Math.PI * 2) * SWAY_PIXELS);
      const faceOn = Math.floor((piece.age + piece.swayOffsetTicks) / FLIP_TICKS) % 2 === 0;
      context.fillStyle = piece.color;
      context.fillRect(Math.round(piece.x) + sway, Math.round(piece.y), faceOn ? 2 : 1, 2);
    }
  }
}
