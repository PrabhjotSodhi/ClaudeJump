const SLOT_COUNT = 3;
const REFILL_TICKS = 240;
const SLOT_INPUT_KEYS = ['card1', 'card2', 'card3'];

// Holds one player's 3 card slots and the shuffled deck they refill from.
// Card effects are not this file's job: update() only reports which card names got played.
export class Hand {
  constructor(cardNames, randomSource) {
    this.cardNames = cardNames;
    this.randomSource = randomSource;
    this.deck = randomSource.shuffle(cardNames);
    this.slots = [];
    this.refillTicksRemaining = [];
    this.keyHeldPreviously = [];
    for (let slotIndex = 0; slotIndex < SLOT_COUNT; slotIndex++) {
      this.slots.push(this.drawCard());
      this.refillTicksRemaining.push(null);
      this.keyHeldPreviously.push(false);
    }
  }

  drawCard() {
    if (this.deck.length === 0) this.deck = this.randomSource.shuffle(this.cardNames);
    return this.deck.pop();
  }

  // A card plays on a fresh key press, never while the key is held. canPlayCards gates play
  // (a dizzy player still ticks refills, it just cannot fire a card). Returns the names played this tick.
  update(input, canPlayCards) {
    const playedCardNames = [];
    for (let slotIndex = 0; slotIndex < SLOT_COUNT; slotIndex++) {
      const keyPressed = input ? Boolean(input[SLOT_INPUT_KEYS[slotIndex]]) : false;
      const freshPress = keyPressed && !this.keyHeldPreviously[slotIndex];
      this.keyHeldPreviously[slotIndex] = keyPressed;
      if (freshPress && canPlayCards && this.slots[slotIndex]) {
        playedCardNames.push(this.slots[slotIndex]);
        this.slots[slotIndex] = null;
        this.refillTicksRemaining[slotIndex] = REFILL_TICKS;
      }
    }

    for (let slotIndex = 0; slotIndex < SLOT_COUNT; slotIndex++) {
      if (this.refillTicksRemaining[slotIndex] === null) continue;
      this.refillTicksRemaining[slotIndex]--;
      if (this.refillTicksRemaining[slotIndex] <= 0) {
        this.slots[slotIndex] = this.drawCard();
        this.refillTicksRemaining[slotIndex] = null;
      }
    }

    return playedCardNames;
  }
}
