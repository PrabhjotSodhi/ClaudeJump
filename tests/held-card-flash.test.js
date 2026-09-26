import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HELD_CARD_FLASH_TICKS, HeldCardFlashTracker } from '../src/ui/held-card-flash.js';

test('a played card flashes for a fixed number of ticks, then disappears', () => {
  const tracker = new HeldCardFlashTracker();
  tracker.notePlayed('red', 'rocket', 100);

  for (let tick = 100; tick < 100 + HELD_CARD_FLASH_TICKS; tick++) {
    assert.equal(tracker.flashingCardName('red', tick), 'rocket');
  }
  assert.equal(tracker.flashingCardName('red', 100 + HELD_CARD_FLASH_TICKS), null);
});

test('the flash lasts the same number of ticks no matter how often it is read', () => {
  const tracker = new HeldCardFlashTracker();
  tracker.notePlayed('red', 'rocket', 0);

  // Reading it many times at the same tick (a high refresh rate rendering several frames per
  // tick) must not shorten the flash the way a per-frame countdown would.
  for (let read = 0; read < 5; read++) tracker.flashingCardName('red', 0);

  assert.equal(tracker.flashingCardName('red', HELD_CARD_FLASH_TICKS - 1), 'rocket');
});

test('a player who never played a card never flashes', () => {
  const tracker = new HeldCardFlashTracker();
  assert.equal(tracker.flashingCardName('blue', 50), null);
});

test('players flash independently of each other', () => {
  const tracker = new HeldCardFlashTracker();
  tracker.notePlayed('red', 'fire', 10);

  assert.equal(tracker.flashingCardName('blue', 10), null);
  assert.equal(tracker.flashingCardName('red', 10), 'fire');
});
