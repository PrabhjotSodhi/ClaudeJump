// Every card a player can hold and play. Dash is a fast burst in the facing direction,
// knocking the opponent back through the same knockback path a bump uses (see versus-scene.js).
// Rocket fires a projectile that explodes on impact, knocking back any player caught in the blast.
// BouncePad drops a pad at the player's feet that launches anyone landing on it from above.
// Fire sets the platform under the opponent alight, popping anyone standing on it periodically.
// Ice freezes the platform under the opponent, cutting their ground acceleration so they slide.
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
  fire: {
    name: 'fire',
  },
  ice: {
    name: 'ice',
  },
};

export const CARD_NAMES = Object.keys(CARD_DEFINITIONS);
