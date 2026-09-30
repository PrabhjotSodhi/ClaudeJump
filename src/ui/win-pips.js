// Pips are display only. They read `round-won` events to time the pop of the newest pip, and never change the match.
const POP_SIZES = [8, 10, 8];
const POP_TICKS_PER_SIZE = 3;

export const PIP_SIZE = 6;

// The size of a pip drawn `ticksSinceWon` ticks after it was won.
export function pipSize(ticksSinceWon) {
  return POP_SIZES[Math.floor(ticksSinceWon / POP_TICKS_PER_SIZE)] ?? PIP_SIZE;
}

export class WinPips {
  constructor() {
    this.lastWinTickByPlayerId = {};
  }

  // getTickCount is read when the event fires, so the pop is timed in scene ticks.
  attach(events, getTickCount) {
    events.on('round-won', ({ playerId }) => {
      this.lastWinTickByPlayerId[playerId] = getTickCount();
    });
    events.on('match-started', () => {
      this.lastWinTickByPlayerId = {};
    });
  }

  // wins is the player's current win count. Only the pip for the latest win pops.
  pipSizeFor(playerId, pipIndex, wins, tickCount) {
    const lastWinTick = this.lastWinTickByPlayerId[playerId];
    if (lastWinTick === undefined || pipIndex !== wins - 1) return PIP_SIZE;
    return pipSize(tickCount - lastWinTick);
  }
}
