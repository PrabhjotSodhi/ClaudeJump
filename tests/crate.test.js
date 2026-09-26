import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Crate, CRATE_HEIGHT, CRATE_WARNING_TICKS } from '../src/entities/crate.js';

test('a crate starts above the screen and lands on its marked spot on the expected tick', () => {
  const markerY = 104;
  const crate = new Crate({ x: 10, y: markerY, cardName: 'dash' });
  const platform = { x: 0, y: markerY + CRATE_HEIGHT, width: 100, height: 8 };

  assert.ok(crate.y + crate.height <= 0, 'starts above the top of the screen');
  assert.equal(crate.landed, false);

  for (let tick = 0; tick < CRATE_WARNING_TICKS - 1; tick++) crate.update([platform]);
  assert.equal(crate.landed, false, 'still not landed one tick before the expected tick');

  crate.update([platform]);
  assert.equal(crate.landed, true, 'lands on the CRATE_WARNING_TICKS-th tick');
  assert.equal(crate.y, markerY, 'lands right on its marked spot');
});

test('a landed crate stays landed', () => {
  const markerY = 104;
  const crate = new Crate({ x: 0, y: markerY, cardName: 'rocket' });
  const platform = { x: 0, y: markerY + CRATE_HEIGHT, width: 100, height: 8 };
  for (let tick = 0; tick < CRATE_WARNING_TICKS + 5; tick++) crate.update([platform]);
  assert.equal(crate.landed, true);

  crate.update([platform]);
  assert.equal(crate.landed, true, 'landing does not undo itself');
  assert.equal(crate.y, markerY);
});

test('a crate with no platform below it keeps falling past its marked spot', () => {
  const markerY = 104;
  const crate = new Crate({ x: 0, y: markerY, cardName: 'dash' });
  for (let tick = 0; tick < CRATE_WARNING_TICKS + 20; tick++) crate.update([]);
  assert.equal(crate.landed, false);
  assert.ok(crate.y > markerY, 'falls straight through the spot with nothing to land on');
});
