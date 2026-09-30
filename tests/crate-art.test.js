import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { canopyStripes, landingBounce } from '../src/entities/crate.js';
import { EventEmitter } from '../src/engine/events.js';
import { CrateOpenings, OPENING_TICKS, spinningIconWidth } from '../src/vfx/crate-openings.js';
import { cordFlutter } from '../src/vfx/parachute-sway.js';

const palette = new Set(
  Object.values(JSON.parse(readFileSync('data/palette.json', 'utf8')).ramps)
    .flat()
    .map((color) => color.toLowerCase()),
);
const ARENAS = ['harbor', 'cave', 'rooftops', 'cooling-towers', 'server-farm', 'bridge', 'quarry'];

test('each arena dresses its canopies in its own palette stripes', () => {
  const stripeSets = ARENAS.map((arena) => canopyStripes(arena));
  assert.equal(new Set(stripeSets.map((stripes) => JSON.stringify(stripes))).size, ARENAS.length);
  for (const stripes of [...stripeSets, canopyStripes('harbor', true)]) {
    assert.equal(stripes.length, 2);
    for (const { color, shade } of stripes) assert.ok(palette.has(color) && palette.has(shade), `${color} ${shade}`);
  }
  assert.notDeepEqual(canopyStripes('harbor', true), canopyStripes('harbor'));
});

test('crate sprites use only palette colors', () => {
  const props = JSON.parse(readFileSync('data/sprites/props.json', 'utf8'));
  for (const frameName of ['crate', 'crate-golden']) {
    const keys = new Set(props.frames[frameName].join(''));
    for (const key of keys) {
      const color = props.colors[key];
      assert.ok(color === null || palette.has(color.toLowerCase()), `${frameName} uses ${color}`);
    }
  }
});

test('a landing crate hops a little and then rests', () => {
  const offsets = Array.from({ length: 30 }, (_, tick) => landingBounce(tick));
  assert.ok(Math.max(...offsets) > 0 && Math.max(...offsets) <= 4);
  assert.ok(offsets.slice(12).every((offset) => offset === 0));
  assert.ok(offsets.every(Number.isInteger));
});

test('parachute cords ripple by at most a pixel', () => {
  const ripples = Array.from({ length: 40 }, (_, tick) => cordFlutter(tick, 3));
  assert.ok(ripples.every((ripple) => Math.abs(ripple) <= 1));
  assert.ok(new Set(ripples).size > 1);
});

test('opening a crate shows the spinning card for about 0.3 seconds', () => {
  const events = new EventEmitter();
  const openings = new CrateOpenings();
  openings.attach(events, () => [{ id: 'red', color: '#f77622' }]);

  events.emit('card-picked-up', { playerId: 'red', cardName: 'rocket', golden: false, x: 100, y: 80 });
  const widths = [];
  let ticks = 0;
  while (openings.openings.length > 0) {
    widths.push(spinningIconWidth(openings.openings[0].age));
    openings.update();
    ticks++;
  }

  assert.equal(ticks, OPENING_TICKS);
  assert.ok(Math.abs(OPENING_TICKS / 60 - 0.3) < 0.05);
  assert.ok(widths.every((width) => Number.isInteger(width) && width >= 2));
  assert.ok(new Set(widths).size > 2, 'the icon turns');
});
