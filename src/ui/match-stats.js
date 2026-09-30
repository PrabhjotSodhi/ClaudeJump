// Players from first to last place by rounds won. Players with equal wins share a rank and keep seat order.
export function rankPlayers(playerIds, wins) {
  const ordered = [...playerIds].sort((first, second) => wins[second] - wins[first]);
  return ordered.map((playerId) => ({
    playerId,
    rank: 1 + ordered.filter((otherId) => wins[otherId] > wins[playerId]).length,
  }));
}

// Counts stats for the results screen. Reads only events, never entities or scene state,
// so it can never change what happened in the match.
export class MatchStats {
  constructor(playerIds) {
    this.playerIds = playerIds;
    this.reset();
  }

  reset() {
    this.fallsIn = {};
    for (const playerId of this.playerIds) {
      this.fallsIn[playerId] = 0;
    }
  }

  // isFight is checked at the moment each event fires: a fall after the round is already
  // decided (a late rocket knocking the winner in, for example) must not count.
  attach(events, isFight) {
    events.on('player-fell-in-water', ({ playerId }) => {
      if (isFight()) this.fallsIn[playerId]++;
    });
  }
}
