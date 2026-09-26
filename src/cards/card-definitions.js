// A fast burst in the facing direction. Dashing into the opponent knocks them back
// through the same knockback path a bump uses (see versus-scene.js).
export const CARD_DEFINITIONS = {
  dash: {
    name: 'dash',
  },
  rocket: {
    name: 'rocket',
  },
};

// How many copies of each card sit in a deck before it is shuffled.
const COPIES_PER_CARD = 6;

export const DECK_CARD_NAMES = Object.keys(CARD_DEFINITIONS).flatMap((name) => Array(COPIES_PER_CARD).fill(name));
