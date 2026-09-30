import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from '../src/engine/events.js';
import { PIP_SIZE, WinPips } from '../src/ui/win-pips.js';

function attachedPips() {
  const events = new EventEmitter();
  const winPips = new WinPips();
  winPips.attach(events, () => 100);
  return { events, winPips };
}

test('the newest pip pops when a round is won, then settles', () => {
  const { events, winPips } = attachedPips();
  events.emit('round-won', { playerId: 'red', wins: 2 });

  assert.ok(winPips.pipSizeFor('red', 1, 2, 101) > PIP_SIZE, 'the pip just won is bigger than resting size');
  assert.equal(winPips.pipSizeFor('red', 0, 2, 101), PIP_SIZE, 'earlier pips stay put');
  assert.equal(winPips.pipSizeFor('blue', 1, 2, 101), PIP_SIZE, 'the other player is unaffected');
  assert.equal(winPips.pipSizeFor('red', 1, 2, 200), PIP_SIZE, 'the pop is over after a moment');
});

test('a new match clears the pop', () => {
  const { events, winPips } = attachedPips();
  events.emit('round-won', { playerId: 'red', wins: 1 });
  events.emit('match-started', {});

  assert.equal(winPips.pipSizeFor('red', 0, 1, 100), PIP_SIZE);
});
