import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Hand } from '../src/cards/hand.js';

test('a slot refills after exactly 240 ticks', () => {
  const hand = new Hand(1);
  hand.play(0);
  assert.equal(hand.slots[0], null);

  for (let tick = 0; tick < 239; tick++) hand.update();
  assert.equal(hand.slots[0], null, 'slot is still empty one tick before the refill');

  hand.update();
  assert.notEqual(hand.slots[0], null, 'slot refills on the 240th tick');
});
