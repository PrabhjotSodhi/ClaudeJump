import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from '../src/engine/events.js';
import { MatchStats, rankPlayers } from '../src/ui/match-stats.js';

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
