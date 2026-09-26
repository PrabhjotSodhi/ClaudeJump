import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SeededRandom } from '../src/engine/seeded-random.js';

const CARD_NAMES = ['dash', 'fireball', 'shield', 'heal', 'bomb'];

test('the same seed deals the same cards', () => {
  const firstDeal = new SeededRandom(42).shuffle(CARD_NAMES);
  const secondDeal = new SeededRandom(42).shuffle(CARD_NAMES);

  assert.deepEqual(firstDeal, secondDeal);
});

test('a different seed deals a different order', () => {
  const dealtWithSeedOne = new SeededRandom(1).shuffle(CARD_NAMES);
  const dealtWithSeedTwo = new SeededRandom(2).shuffle(CARD_NAMES);

  assert.notDeepEqual(dealtWithSeedOne, dealtWithSeedTwo);
});
