import { AWARD_FIRST_DELAY_TICKS, AWARD_INTERVAL_TICKS } from '../engine/config.js';

// Hands out the awards of a finished match one at a time. Call update() once per tick while the results show.
// It emits 'award-shown' as each one appears so the sound can play.
export class AwardReveal {
  constructor(awards, events) {
    this.awards = awards;
    this.events = events;
    this.ticks = 0;
    this.revealedCount = 0;
  }

  update() {
    this.ticks++;
    if (this.revealedCount >= this.awards.length) return;
    const nextTick = AWARD_FIRST_DELAY_TICKS + this.revealedCount * AWARD_INTERVAL_TICKS;
    if (this.ticks < nextTick) return;
    this.revealedCount++;
    this.events.emit('award-shown', this.awards[this.revealedCount - 1]);
  }

  // Ticks since this player's award appeared, or -1 while it is still hidden or the player has none.
  ticksSinceShown(playerId) {
    const index = this.awards.findIndex((award) => award.playerId === playerId);
    if (index < 0 || index >= this.revealedCount) return -1;
    return this.ticks - (AWARD_FIRST_DELAY_TICKS + index * AWARD_INTERVAL_TICKS);
  }

  awardFor(playerId) {
    return this.awards.find((award) => award.playerId === playerId);
  }
}
