import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from '../src/engine/events.js';
import { ClashSparks } from '../src/vfx/clash-sparks.js';

test('a clash shows sparks in both player colors and then goes away', () => {
  const events = new EventEmitter();
  const players = [
    { id: 'red', color: '#ff0000' },
    { id: 'blue', color: '#0000ff' },
  ];
  let tickCount = 5;
  const clashSparks = new ClashSparks();
  clashSparks.attach(
    events,
    () => players,
    () => tickCount,
  );

  events.emit('shove-clash', { x: 100, y: 50, playerIds: ['red', 'blue'] });

  assert.deepEqual(clashSparks.activeClashes(tickCount)[0].colors, ['#ff0000', '#0000ff']);
  tickCount += 100;
  assert.equal(clashSparks.activeClashes(tickCount).length, 0);
});
