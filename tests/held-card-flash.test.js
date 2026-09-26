import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HELD_CARD_FLASH_FRAMES, HeldCardFlashTracker } from '../src/ui/held-card-flash.js';

test('a played card flashes for a fixed number of frames, then disappears', () => {
  const tracker = new HeldCardFlashTracker();
  tracker.notePlayed('red', 'rocket');

  for (let frame = 0; frame < HELD_CARD_FLASH_FRAMES; frame++) {
    assert.equal(tracker.consumeFlash('red'), 'rocket');
  }
  assert.equal(tracker.consumeFlash('red'), null);
});

test('a player who never played a card never flashes', () => {
  const tracker = new HeldCardFlashTracker();
  assert.equal(tracker.consumeFlash('blue'), null);
});

test('players flash independently of each other', () => {
  const tracker = new HeldCardFlashTracker();
  tracker.notePlayed('red', 'fire');

  assert.equal(tracker.consumeFlash('blue'), null);
  assert.equal(tracker.consumeFlash('red'), 'fire');
});
