import { SCREEN_WIDTH } from '../engine/config.js';
import { FRAME_SIZE } from '../vfx/character-body.js';

// Tune numbers for character card motion, all in ticks and whole pixels.
export const HOP_TICKS = 24;
export const HOP_HEIGHT = 10;
export const SEAT_SLIDE_TICKS = 16;
export const CHEER_HOP_TICKS = 16;
export const CHEER_HOP_HEIGHT = 8;
// Extra pixels the body is squashed by on each tick after it lands. It gets wider and shorter.
export const LANDING_SQUASH_PIXELS = [4, 3, 2, 1];
// While a body is this high above its rest, it is stretched tall and thin.
const STRETCH_MIN_HEIGHT = 5;
const STRETCH_PIXELS = 2;

export const CHEER_TICKS = 2 * CHEER_HOP_TICKS + LANDING_SQUASH_PIXELS.length;

const RESTING_POSE = { offsetY: 0, width: FRAME_SIZE, height: FRAME_SIZE };

// How many pixels above its rest a body is this many ticks into a parabolic jump that lands at `duration`.
function arcHeight(ticks, duration, height) {
  return Math.round((height * 4 * ticks * (duration - ticks)) / (duration * duration));
}

function poseFor(offsetY, squashPixels) {
  const stretchPixels = offsetY >= STRETCH_MIN_HEIGHT ? STRETCH_PIXELS : 0;
  return {
    offsetY,
    width: FRAME_SIZE + squashPixels - stretchPixels,
    height: FRAME_SIZE - squashPixels + stretchPixels,
  };
}

// The body after picking a new character: one hop onto the plinth, then a squash on landing.
export function hopPose(ticksSinceHop) {
  if (ticksSinceHop < 0) return RESTING_POSE;
  if (ticksSinceHop < HOP_TICKS) return poseFor(arcHeight(ticksSinceHop, HOP_TICKS, HOP_HEIGHT), 0);
  return poseFor(0, LANDING_SQUASH_PIXELS[ticksSinceHop - HOP_TICKS] ?? 0);
}

// The body after locking in: two small hops, each landing with a squash, and one last squash to settle.
export function cheerPose(ticksSinceCheer) {
  if (ticksSinceCheer < 0) return RESTING_POSE;
  if (ticksSinceCheer < 2 * CHEER_HOP_TICKS) {
    const ticksIntoHop = ticksSinceCheer % CHEER_HOP_TICKS;
    const squash = ticksSinceCheer >= CHEER_HOP_TICKS ? (LANDING_SQUASH_PIXELS[ticksIntoHop] ?? 0) : 0;
    return poseFor(arcHeight(ticksIntoHop, CHEER_HOP_TICKS, CHEER_HOP_HEIGHT), squash);
  }
  return poseFor(0, LANDING_SQUASH_PIXELS[ticksSinceCheer - 2 * CHEER_HOP_TICKS] ?? 0);
}

// How far a card is shifted sideways this many ticks after its player joined. Cards on the left half of the
// screen come in from the left edge, the others from the right, easing out.
export function seatSlideOffsetX(ticksSinceJoin, cardBox) {
  const remaining = 1 - Math.min(Math.max(ticksSinceJoin, 0), SEAT_SLIDE_TICKS) / SEAT_SLIDE_TICKS;
  const fromLeft = cardBox.x + cardBox.width / 2 < SCREEN_WIDTH / 2;
  const distance = fromLeft ? -(cardBox.x + cardBox.width) : SCREEN_WIDTH - cardBox.x;
  return Math.round(distance * remaining * remaining);
}

// The motion of a row of character cards, driven by ticks and keyed by seat index. Call update() every tick
// and join(), hop() and cheer() when a seat does those things. It only reads what the scene tells it.
export class SelectCardMotion {
  constructor() {
    this.tick = 0;
    this.joinTickBySeat = {};
    this.hopTickBySeat = {};
    this.cheerTickBySeat = {};
    this.seenSeats = null;
  }

  update() {
    this.tick++;
  }

  join(seat) {
    this.joinTickBySeat[seat] = this.tick;
  }

  hop(seat) {
    this.hopTickBySeat[seat] = this.tick;
  }

  cheer(seat) {
    this.cheerTickBySeat[seat] = this.tick;
  }

  slideOffsetX(seat, cardBox) {
    if (!(seat in this.joinTickBySeat)) return 0;
    return seatSlideOffsetX(this.tick - this.joinTickBySeat[seat], cardBox);
  }

  // The most recent of the hop and the cheer decides the pose.
  pose(seat) {
    const hopTick = this.hopTickBySeat[seat] ?? -Infinity;
    const cheerTick = this.cheerTickBySeat[seat] ?? -Infinity;
    if (cheerTick > hopTick) return cheerPose(this.tick - cheerTick);
    if (hopTick > -Infinity) return hopPose(this.tick - hopTick);
    return RESTING_POSE;
  }

  // For rooms whose seats come from the network: compares the seats with the ones seen last time, starts the
  // matching motion and returns what changed as [{ seat, kind: 'joined' | 'changed' | 'cheered' }].
  // A seat is { characterName, ready } or null.
  observeSeats(seats) {
    const changes = [];
    seats.forEach((seat, index) => {
      const seen = this.seenSeats?.[index] ?? null;
      if (seat && !seen) {
        this.join(index);
        changes.push({ seat: index, kind: 'joined' });
      } else if (seat && seat.characterName !== seen.characterName) {
        this.hop(index);
        changes.push({ seat: index, kind: 'changed' });
      }
      if (seat?.ready && !seen?.ready) {
        this.cheer(index);
        changes.push({ seat: index, kind: 'cheered' });
      }
    });
    this.seenSeats = seats.map((seat) => (seat ? { characterName: seat.characterName, ready: seat.ready } : null));
    return changes;
  }
}
