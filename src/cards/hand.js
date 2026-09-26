import { SeededRandom } from '../engine/seeded-random.js';
import { DECK_CARD_NAMES } from './card-definitions.js';

export const HAND_SLOT_COUNT = 3;
const REFILL_TICKS = 240;

// A player's hand: a fixed number of slots, each refilled from that player's own
// shuffled deck a fixed number of ticks after it is played.
export class Hand {
  constructor(seed) {
    this.random = new SeededRandom(seed);
    this.drawPile = [];
    this.slots = new Array(HAND_SLOT_COUNT).fill(null);
    this.refillTicksRemaining = new Array(HAND_SLOT_COUNT).fill(0);
    for (let slotIndex = 0; slotIndex < HAND_SLOT_COUNT; slotIndex++) this.slots[slotIndex] = this.drawCard();
  }

  drawCard() {
    if (this.drawPile.length === 0) this.drawPile = this.random.shuffle(DECK_CARD_NAMES);
    return this.drawPile.pop();
  }

  update() {
    for (let slotIndex = 0; slotIndex < HAND_SLOT_COUNT; slotIndex++) {
      if (this.slots[slotIndex] !== null) continue;
      this.refillTicksRemaining[slotIndex]--;
      if (this.refillTicksRemaining[slotIndex] <= 0) this.slots[slotIndex] = this.drawCard();
    }
  }

  play(slotIndex) {
    const cardName = this.slots[slotIndex];
    if (cardName === null) return null;
    this.slots[slotIndex] = null;
    this.refillTicksRemaining[slotIndex] = REFILL_TICKS;
    return cardName;
  }
}
