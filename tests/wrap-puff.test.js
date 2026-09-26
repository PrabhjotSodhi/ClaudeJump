import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from '../src/engine/events.js';
import { WRAP_PUFF_FADE_TICKS, WrapPuffTracker } from '../src/vfx/wrap-puff.js';

test('a puff appears where a player wraps, then disappears once its fade ends', () => {
  const events = new EventEmitter();
  const tracker = new WrapPuffTracker();
  let tickCount = 0;
  const players = [{ id: 'red', color: '#dc2828' }];
  tracker.attach(
    events,
    () => players,
    () => tickCount,
  );

  assert.deepEqual(tracker.activePuffs(tickCount), []);

  events.emit('player-wrapped', { playerId: 'red', x: 5, y: 60 });
  const puffsJustAfterWrap = tracker.activePuffs(tickCount);
  assert.equal(puffsJustAfterWrap.length, 1);
  assert.equal(puffsJustAfterWrap[0].color, '#dc2828');
  assert.equal(puffsJustAfterWrap[0].x, 5);
  assert.equal(puffsJustAfterWrap[0].y, 60);

  tickCount += WRAP_PUFF_FADE_TICKS - 1;
  assert.equal(tracker.activePuffs(tickCount).length, 1, 'still visible just before the fade ends');

  tickCount += 1;
  assert.equal(tracker.activePuffs(tickCount).length, 0, 'gone once the fade finishes');
});

test('an event for a player the tracker cannot find never adds a puff', () => {
  const events = new EventEmitter();
  const tracker = new WrapPuffTracker();
  tracker.attach(
    events,
    () => [],
    () => 0,
  );

  events.emit('player-wrapped', { playerId: 'red', x: 5, y: 60 });

  assert.deepEqual(tracker.activePuffs(0), []);
});

test('each wrap adds its own puff, independent of the others', () => {
  const events = new EventEmitter();
  const tracker = new WrapPuffTracker();
  let tickCount = 0;
  const players = [
    { id: 'red', color: '#dc2828' },
    { id: 'blue', color: '#2846dc' },
  ];
  tracker.attach(
    events,
    () => players,
    () => tickCount,
  );

  events.emit('player-wrapped', { playerId: 'red', x: 5, y: 60 });
  tickCount += 5;
  events.emit('player-wrapped', { playerId: 'blue', x: 300, y: 100 });

  assert.equal(tracker.activePuffs(tickCount).length, 2, 'both puffs are visible while red has not faded yet');

  tickCount += WRAP_PUFF_FADE_TICKS - 5;
  assert.equal(tracker.activePuffs(tickCount).length, 1, "red's puff faded first; blue's is still fresh");
});
