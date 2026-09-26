import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from '../src/engine/events.js';
import { MatchStats } from '../src/ui/match-stats.js';

function attachedStats(isFight = () => true) {
  const events = new EventEmitter();
  const stats = new MatchStats(['red', 'blue']);
  stats.attach(events, isFight);
  return { events, stats };
}

test('stats match the events emitted during a match', () => {
  const { events, stats } = attachedStats();

  events.emit('player-stomped', { stomperId: 'red', stompedId: 'blue' });
  events.emit('player-stomped', { stomperId: 'red', stompedId: 'blue' });
  events.emit('player-fell-in-water', { playerId: 'blue' });
  events.emit('player-fell-in-water', { playerId: 'blue' });
  events.emit('player-fell-in-water', { playerId: 'red' });

  assert.deepEqual(stats.stomps, { red: 2, blue: 0 });
  assert.deepEqual(stats.fallsIn, { red: 1, blue: 2 });
});

test('events that fire outside a fight are not counted', () => {
  let isFight = true;
  const { events, stats } = attachedStats(() => isFight);

  events.emit('player-stomped', { stomperId: 'red', stompedId: 'blue' });
  isFight = false; // the round has already been decided (a late rocket, for example)
  events.emit('player-fell-in-water', { playerId: 'blue' });

  assert.deepEqual(stats.stomps, { red: 1, blue: 0 });
  assert.deepEqual(stats.fallsIn, { red: 0, blue: 0 });
});

test('reset clears every player back to zero', () => {
  const { events, stats } = attachedStats();

  events.emit('player-stomped', { stomperId: 'red', stompedId: 'blue' });
  stats.reset();

  assert.deepEqual(stats.stomps, { red: 0, blue: 0 });
  assert.deepEqual(stats.fallsIn, { red: 0, blue: 0 });
});

test('the most stomps badge goes to the single player with the most stomps', () => {
  const { events, stats } = attachedStats();

  events.emit('player-stomped', { stomperId: 'red', stompedId: 'blue' });
  events.emit('player-stomped', { stomperId: 'red', stompedId: 'blue' });
  events.emit('player-stomped', { stomperId: 'blue', stompedId: 'red' });

  assert.deepEqual(stats.mostStomps(), ['red']);
});

test('a tie for the most stomps gives the badge to every tied player', () => {
  const { events, stats } = attachedStats();

  events.emit('player-stomped', { stomperId: 'red', stompedId: 'blue' });
  events.emit('player-stomped', { stomperId: 'blue', stompedId: 'red' });

  assert.deepEqual(new Set(stats.mostStomps()), new Set(['red', 'blue']));
});

test('nobody gets the badge when nobody has landed a stomp', () => {
  const { stats } = attachedStats();

  assert.deepEqual(stats.mostStomps(), []);
});
