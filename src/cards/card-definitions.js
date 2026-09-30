// Every card a player can hold and play. Dash is a fast burst in the facing direction,
// knocking the opponent back on contact.
// Rocket fires a projectile that explodes on impact, knocking back any player caught in the blast.
// Bomb is lobbed in an arc and explodes on contact or when its fuse runs out, with the rocket's blast.
// Banana is dropped behind the player and makes the first other player who steps on it slide.
// BouncePad drops a pad at the player's feet that launches anyone landing on it from above.
// Magnet pulls every other player toward the player for a moment.
// SpringShoes makes the player's next few jumps go twice as high.
// Freeze throws an ice shot that freezes the first other player it hits, who then slides on shoves.
import { CARD_CRATE_WEIGHTS } from '../engine/config.js';

export const CARD_DEFINITIONS = {
  dash: {
    name: 'dash',
  },
  rocket: {
    name: 'rocket',
  },
  bouncePad: {
    name: 'bouncePad',
  },
  bomb: {
    name: 'bomb',
  },
  banana: {
    name: 'banana',
  },
  magnet: {
    name: 'magnet',
  },
  springShoes: {
    name: 'springShoes',
  },
  freeze: {
    name: 'freeze',
  },
};

// Every pickup can be played this many times before it is gone.
export const PICKUP_USES = 1;
// A golden crate gives this many.
export const GOLDEN_PICKUP_USES = 2;

export const CARD_NAMES = Object.keys(CARD_DEFINITIONS);

// The card a crate holds, picked by CARD_CRATE_WEIGHTS from `roll`, a number from 0 up to but not including 1.
export function crateCardFor(roll) {
  const totalWeight = CARD_NAMES.reduce((total, cardName) => total + CARD_CRATE_WEIGHTS[cardName], 0);
  let remaining = roll * totalWeight;
  for (const cardName of CARD_NAMES) {
    remaining -= CARD_CRATE_WEIGHTS[cardName];
    if (remaining < 0) return cardName;
  }
  return CARD_NAMES[CARD_NAMES.length - 1];
}
