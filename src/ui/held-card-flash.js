// Display-only state driven by the card-played event and the scene's tick counter. Never read
// by game logic, and never changes it: a player's held card and its rules live entirely on the
// Player entity. Timed in ticks, not rendered frames, so it lasts the same real time regardless
// of the screen's refresh rate.
const FLASH_TICKS = 12;

export class HeldCardFlashTracker {
  constructor() {
    this.playedByPlayerId = {};
  }

  notePlayed(playerId, cardName, tick) {
    this.playedByPlayerId[playerId] = { cardName, tick };
  }

  // Returns the played card's name while its flash is still running at currentTick, or null
  // once FLASH_TICKS have passed (or nothing was ever played).
  flashingCardName(playerId, currentTick) {
    const played = this.playedByPlayerId[playerId];
    if (!played) return null;
    return currentTick - played.tick < FLASH_TICKS ? played.cardName : null;
  }
}

export const HELD_CARD_FLASH_TICKS = FLASH_TICKS;
