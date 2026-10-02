import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { canopyStripes, landingBounce } from '../src/entities/crate.js';
import { EventEmitter } from '../src/engine/events.js';
import {
  BREAK_TICKS,
  CrateOpenings,
  OPENING_TICKS,
  plankRectangles,
  spinningIconWidth,
} from '../src/vfx/crate-openings.js';
import { cordFlutter } from '../src/vfx/parachute-sway.js';

const palette = new Set(
  Object.values(JSON.parse(readFileSync('data/palette.json', 'utf8')).ramps)
    .flat()
    .map((color) => color.toLowerCase()),
);
const ARENAS = [
  'harbor',
  'cave',
  'rooftops',
  'cooling-towers',
  'server-farm',
  'bridge',
  'quarry',
  'lighthouse',
  'shipyard',
];

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

test('an opened crate breaks into planks that fly apart, rise and fall back under gravity', () => {
  const events = new EventEmitter();
  const openings = new CrateOpenings();
  openings.attach(events, () => [{ id: 'red', color: '#f77622' }]);
  events.emit('card-picked-up', { playerId: 'red', cardName: 'rocket', golden: false, x: 100, y: 80 });

  const [crateBreak] = openings.breaks;
  const start = plankRectangles({ ...crateBreak, age: 0 });
  const early = plankRectangles({ ...crateBreak, age: 6 });
  const late = plankRectangles({ ...crateBreak, age: BREAK_TICKS - 1 });
  const middleX = (rectangle) => rectangle.x + rectangle.width / 2;
  assert.ok(early.some((plank) => middleX(plank) < 90) && early.some((plank) => middleX(plank) > 110), 'both ways');
  assert.ok(
    early.every((plank, index) => plank.y < start[index].y + 2),
    'they are thrown up first',
  );
  assert.ok(
    late.every((plank, index) => plank.y > start[index].y),
    'then gravity brings them down',
  );
  for (const plank of [...start, ...early, ...late]) {
    for (const value of Object.values(plank)) assert.ok(Number.isInteger(value));
  }
});

test('a crate that sinks breaks apart in the water the same way', () => {
  const events = new EventEmitter();
  const openings = new CrateOpenings();
  openings.attach(events, () => []);
  events.emit('crate-fell-in-water', { x: 100, y: 328, golden: true });
  assert.equal(openings.breaks.length, 1);
  assert.equal(openings.openings.length, 0, 'no card comes out of a sunk crate');
  let ticks = 0;
  while (openings.breaks.length > 0) {
    openings.update();
    ticks++;
  }
  assert.equal(ticks, BREAK_TICKS);
});
