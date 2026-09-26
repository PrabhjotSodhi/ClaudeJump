import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Crate, CRATE_WARNING_TICKS } from '../src/entities/crate.js';

test('a crate lands after showing its warning marker for CRATE_WARNING_TICKS ticks', () => {
  const crate = new Crate({ x: 10, y: 20, cardName: 'dash' });
  assert.equal(crate.landed, false);

  for (let tick = 0; tick < CRATE_WARNING_TICKS - 1; tick++) crate.update();
  assert.equal(crate.landed, false, 'still warning one tick before landing');

  crate.update();
  assert.equal(crate.landed, true, 'lands on the CRATE_WARNING_TICKS-th tick');
});

test('a landed crate stays landed', () => {
  const crate = new Crate({ x: 0, y: 0, cardName: 'rocket' });
  for (let tick = 0; tick < CRATE_WARNING_TICKS + 5; tick++) crate.update();
  assert.equal(crate.landed, true);
});
