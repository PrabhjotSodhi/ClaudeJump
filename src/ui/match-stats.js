// Counts stats for the results screen. Reads only events, never entities or scene state,
// so it can never change what happened in the match.
export class MatchStats {
  constructor(playerIds) {
    this.playerIds = playerIds;
    this.reset();
  }

  reset() {
    this.stomps = {};
    this.fallsIn = {};
    for (const playerId of this.playerIds) {
      this.stomps[playerId] = 0;
      this.fallsIn[playerId] = 0;
    }
  }

  // isFight is checked at the moment each event fires: a fall or a stomp landed after the round
  // is already decided (a late rocket knocking the winner in, for example) must not count.
  attach(events, isFight) {
    events.on('player-stomped', ({ stomperId }) => {
      if (isFight()) this.stomps[stomperId]++;
    });
    events.on('player-fell-in-water', ({ playerId }) => {
      if (isFight()) this.fallsIn[playerId]++;
    });
  }

  mostStomps() {
    const highestStompCount = Math.max(...this.playerIds.map((playerId) => this.stomps[playerId]));
    if (highestStompCount === 0) return [];
    return this.playerIds.filter((playerId) => this.stomps[playerId] === highestStompCount);
  }
}
