// Display-only state driven by the card-played event. Never read by game logic, and never
// changes it: a player's held card and its rules live entirely on the Player entity.
const FLASH_FRAMES = 12;

export class HeldCardFlashTracker {
  constructor() {
    this.flashesByPlayerId = {};
  }

  notePlayed(playerId, cardName) {
    this.flashesByPlayerId[playerId] = { cardName, framesRemaining: FLASH_FRAMES };
  }

  // Call once per rendered frame. Returns the played card's name while its flash is still
  // running, or null once it has finished (or nothing was ever played).
  consumeFlash(playerId) {
    const flash = this.flashesByPlayerId[playerId];
    if (!flash) return null;

    flash.framesRemaining--;
    if (flash.framesRemaining <= 0) delete this.flashesByPlayerId[playerId];
    return flash.cardName;
  }
}

export const HELD_CARD_FLASH_FRAMES = FLASH_FRAMES;
