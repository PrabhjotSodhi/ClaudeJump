import { CLUTCH_SECONDS } from '../engine/config.js';

// Players from first to last place by rounds won. Players with equal wins share a rank and keep seat order.
export function rankPlayers(playerIds, wins) {
  const ordered = [...playerIds].sort((first, second) => wins[second] - wins[first]);
  return ordered.map((playerId) => ({
    playerId,
    rank: 1 + ordered.filter((otherId) => wins[otherId] > wins[playerId]).length,
  }));
}

// Awards in the order they are handed out. Each one goes to the player with the most of its stat, and a player
// who already won an award is skipped, so nobody gets two. A stat of zero wins nothing.
const AWARDS = [
  { id: 'clutch', label: 'Clutch survivor', stat: 'clutchWins' },
  { id: 'shoves', label: 'Most shoves', stat: 'shoves' },
  { id: 'cards', label: 'Card shark', stat: 'cardsPlayed' },
  { id: 'splashes', label: 'Most splashes', stat: 'fallsIn' },
  { id: 'jumps', label: 'Bunny hopper', stat: 'jumps' },
];

// stats holds one count per player for each stat name. Ties go to the earlier seat in playerIds.
export function pickAwards(stats, playerIds) {
  const awarded = [];
  for (const { id, label, stat } of AWARDS) {
    let best = null;
    for (const playerId of playerIds) {
      if (awarded.some((award) => award.playerId === playerId)) continue;
      if (stats[stat][playerId] > 0 && (best === null || stats[stat][playerId] > stats[stat][best])) best = playerId;
    }
    if (best !== null) awarded.push({ playerId: best, awardId: id, label });
  }
  return awarded;
}

// Counts stats for the results screen. Reads only events, never entities or scene state,
// so it can never change what happened in the match.
export class MatchStats {
  constructor(playerIds) {
    this.playerIds = playerIds;
    this.reset();
  }

  reset() {
    this.fallsIn = this.zeroCounts();
    this.shoves = this.zeroCounts();
    this.cardsPlayed = this.zeroCounts();
    this.jumps = this.zeroCounts();
    this.clutchWins = this.zeroCounts();
    this.timeWasShort = false;
  }

  zeroCounts() {
    return Object.fromEntries(this.playerIds.map((playerId) => [playerId, 0]));
  }

  // isFight is checked at the moment each event fires: a fall after the round is already
  // decided (a late rocket knocking the winner in, for example) must not count.
  attach(events, isFight) {
    events.on('player-fell-in-water', ({ playerId }) => {
      if (isFight()) this.fallsIn[playerId]++;
    });
    events.on('player-shoved', ({ shoverId }) => {
      if (isFight()) this.shoves[shoverId]++;
    });
    events.on('card-played', ({ playerId }) => {
      if (isFight()) this.cardsPlayed[playerId]++;
    });
    events.on('player-jumped', ({ playerId }) => {
      if (isFight()) this.jumps[playerId]++;
    });
    // A round won after the sudden death countdown reached its last CLUTCH_SECONDS was a close one.
    events.on('round-started', () => {
      this.timeWasShort = false;
    });
    events.on('timer-ticked', ({ secondsRemaining }) => {
      if (secondsRemaining <= CLUTCH_SECONDS) this.timeWasShort = true;
    });
    events.on('round-won', ({ playerId }) => {
      if (this.timeWasShort) this.clutchWins[playerId]++;
    });
  }
}
