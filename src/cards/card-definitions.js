// Every card a player can hold and play. Dash is a fast burst in the facing direction,
// knocking the opponent back through the same knockback path a bump uses (see versus-scene.js).
// Rocket fires a projectile that explodes on impact, knocking back any player caught in the blast.
export const CARD_DEFINITIONS = {
  dash: {
    name: 'dash',
  },
  rocket: {
    name: 'rocket',
  },
};

export const CARD_NAMES = Object.keys(CARD_DEFINITIONS);
