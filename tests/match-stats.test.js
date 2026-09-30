import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from '../src/engine/events.js';
import { MatchStats, pickAwards, rankPlayers } from '../src/ui/match-stats.js';

function attachedStats(isFight = () => true) {
  const events = new EventEmitter();
  const stats = new MatchStats(['red', 'blue']);
  stats.attach(events, isFight);
  return { events, stats };
}

test('stats match the events emitted during a match', () => {
  const { events, stats } = attachedStats();

  events.emit('player-fell-in-water', { playerId: 'blue' });
  events.emit('player-fell-in-water', { playerId: 'blue' });
  events.emit('player-fell-in-water', { playerId: 'red' });

  assert.deepEqual(stats.fallsIn, { red: 1, blue: 2 });
});

test('events that fire outside a fight are not counted', () => {
  let isFight = true;
  const { events, stats } = attachedStats(() => isFight);

  events.emit('player-fell-in-water', { playerId: 'red' });
  isFight = false; // the round has already been decided (a late rocket, for example)
  events.emit('player-fell-in-water', { playerId: 'blue' });

  assert.deepEqual(stats.fallsIn, { red: 1, blue: 0 });
});

test('reset clears every player back to zero', () => {
  const { events, stats } = attachedStats();

  events.emit('player-fell-in-water', { playerId: 'red' });
  stats.reset();

  assert.deepEqual(stats.fallsIn, { red: 0, blue: 0 });
});

test('players are ranked by rounds won, and equal wins share a rank in seat order', () => {
  const wins = { red: 1, blue: 5, green: 1, yellow: 3 };

  assert.deepEqual(rankPlayers(['red', 'blue', 'green', 'yellow'], wins), [
    { playerId: 'blue', rank: 1 },
    { playerId: 'yellow', rank: 2 },
    { playerId: 'red', rank: 3 },
    { playerId: 'green', rank: 3 },
  ]);
});

function statsOf(overrides = {}) {
  const zeros = { red: 0, blue: 0, green: 0, yellow: 0 };
  return { clutchWins: zeros, shoves: zeros, cardsPlayed: zeros, fallsIn: zeros, jumps: zeros, ...overrides };
}
const SEATS = ['red', 'blue', 'green', 'yellow'];

test('each award goes to the player with the most of its stat', () => {
  const stats = statsOf({
    shoves: { red: 1, blue: 6, green: 2, yellow: 0 },
    cardsPlayed: { red: 0, blue: 0, green: 3, yellow: 1 },
    fallsIn: { red: 0, blue: 0, green: 0, yellow: 4 },
  });

  const awards = pickAwards(stats, SEATS);

  assert.deepEqual(
    awards.map(({ playerId, awardId }) => [playerId, awardId]),
    [
      ['blue', 'shoves'],
      ['green', 'cards'],
      ['yellow', 'splashes'],
    ],
  );
});

test('a tie goes to the earlier seat', () => {
  const stats = statsOf({ shoves: { red: 0, blue: 3, green: 3, yellow: 3 } });

  assert.deepEqual(
    pickAwards(stats, SEATS).map(({ playerId }) => playerId),
    ['blue'],
  );
  assert.deepEqual(
    pickAwards(stats, ['yellow', 'green', 'blue', 'red']).map(({ playerId }) => playerId),
    ['yellow'],
  );
});

test('a player who leads several stats gets one award and the rest go to the next best players', () => {
  const stats = statsOf({
    shoves: { red: 9, blue: 2, green: 0, yellow: 0 },
    cardsPlayed: { red: 9, blue: 1, green: 0, yellow: 0 },
    fallsIn: { red: 9, blue: 1, green: 0, yellow: 0 },
  });

  const awards = pickAwards(stats, ['red', 'blue']);

  assert.deepEqual(
    awards.map(({ playerId, awardId }) => [playerId, awardId]),
    [
      ['red', 'shoves'],
      ['blue', 'cards'],
    ],
  );
});

test('a stat nobody scored gives no award, and awards never repeat a player or an award', () => {
  assert.deepEqual(pickAwards(statsOf(), SEATS), []);

  const ones = { red: 1, blue: 1, green: 1, yellow: 1 };
  const busy = statsOf({ clutchWins: ones, shoves: ones, cardsPlayed: ones, fallsIn: ones, jumps: ones });
  const awards = pickAwards(busy, SEATS);
  assert.equal(new Set(awards.map(({ awardId }) => awardId)).size, awards.length);
  assert.deepEqual(
    awards.map(({ playerId }) => playerId),
    SEATS,
  );
});

test('shoves, cards and jumps are counted from events during a fight only', () => {
  let isFight = true;
  const { events, stats } = attachedStats(() => isFight);

  events.emit('player-shoved', { shoverId: 'red', targetId: 'blue' });
  events.emit('card-played', { playerId: 'blue', cardName: 'rocket' });
  events.emit('player-jumped', { playerId: 'blue' });
  isFight = false;
  events.emit('player-shoved', { shoverId: 'red', targetId: 'blue' });

  assert.deepEqual(stats.shoves, { red: 1, blue: 0 });
  assert.deepEqual(stats.cardsPlayed, { red: 0, blue: 1 });
  assert.deepEqual(stats.jumps, { red: 0, blue: 1 });
});

test('winning a round with 3 seconds or less on the countdown counts as a clutch', () => {
  const { events, stats } = attachedStats();

  events.emit('round-started', {});
  events.emit('timer-ticked', { secondsRemaining: 5 });
  events.emit('round-won', { playerId: 'red', wins: 1 });
  events.emit('round-started', {});
  events.emit('timer-ticked', { secondsRemaining: 3 });
  events.emit('round-won', { playerId: 'blue', wins: 1 });
  events.emit('round-started', {});
  events.emit('round-won', { playerId: 'red', wins: 2 });

  assert.deepEqual(stats.clutchWins, { red: 0, blue: 1 });
});
