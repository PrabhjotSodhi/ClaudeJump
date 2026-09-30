import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CHARACTERS } from '../src/entities/characters.js';
import { cardBox } from '../src/ui/online-lobby-view.js';
import {
  CHEER_TICKS,
  cheerPose,
  HOP_TICKS,
  hopPose,
  LANDING_SQUASH_PIXELS,
  SEAT_SLIDE_TICKS,
  SelectCardMotion,
  seatSlideOffsetX,
} from '../src/ui/select-card-motion.js';

const soundDefinitions = JSON.parse(readFileSync('data/sfx/sounds.json', 'utf8'));
const eventSounds = JSON.parse(readFileSync('data/sfx/event-sounds.json', 'utf8'));

test('a hop leaves the plinth, peaks in the middle, lands and squashes wider and shorter', () => {
  assert.equal(hopPose(-1).offsetY, 0);
  assert.ok(hopPose(4).offsetY > 0);
  assert.ok(hopPose(HOP_TICKS / 2).offsetY > hopPose(4).offsetY);
  assert.equal(hopPose(HOP_TICKS).offsetY, 0);
  const landed = hopPose(HOP_TICKS);
  assert.ok(landed.width > 32 && landed.height < 32);
  assert.equal(landed.width - 32, LANDING_SQUASH_PIXELS[0]);
  const settled = hopPose(HOP_TICKS + LANDING_SQUASH_PIXELS.length);
  assert.deepEqual([settled.offsetY, settled.width, settled.height], [0, 32, 32]);
});

test('a hop stretches the body tall near its peak', () => {
  const peak = hopPose(HOP_TICKS / 2);
  assert.ok(peak.height > 32 && peak.width < 32);
});

test('a cheer is two hops that ends at rest', () => {
  const heights = Array.from({ length: CHEER_TICKS }, (_, tick) => cheerPose(tick).offsetY);
  assert.equal(heights.filter((height, tick) => height > 0 && (heights[tick - 1] ?? 0) === 0).length, 2);
  const settled = cheerPose(CHEER_TICKS);
  assert.deepEqual([settled.offsetY, settled.width, settled.height], [0, 32, 32]);
});

test('every pose is in whole pixels', () => {
  for (let tick = 0; tick < CHEER_TICKS + 4; tick++) {
    for (const pose of [hopPose(tick), cheerPose(tick)]) {
      for (const value of Object.values(pose)) assert.ok(Number.isInteger(value));
    }
  }
});

test('cards slide in from the edge nearest their seat and come to rest', () => {
  assert.ok(seatSlideOffsetX(0, cardBox(0)) < 0);
  assert.ok(seatSlideOffsetX(0, cardBox(1)) < 0);
  assert.ok(seatSlideOffsetX(0, cardBox(2)) > 0);
  assert.ok(seatSlideOffsetX(0, cardBox(3)) > 0);
  for (let seat = 0; seat < 4; seat++) {
    assert.ok(seatSlideOffsetX(SEAT_SLIDE_TICKS, cardBox(seat)) === 0);
    assert.ok(Math.abs(seatSlideOffsetX(5, cardBox(seat))) < Math.abs(seatSlideOffsetX(0, cardBox(seat))));
  }
});

test('observing seats starts a slide for a join, a hop for a new character and a cheer for ready', () => {
  const motion = new SelectCardMotion();
  const seat = (characterName, ready = false) => ({ characterName, ready });

  assert.deepEqual(motion.observeSeats([seat('claude'), null, null, null]), [{ seat: 0, kind: 'joined' }]);
  assert.deepEqual(motion.observeSeats([seat('claude'), null, null, null]), []);
  assert.deepEqual(motion.observeSeats([seat('meta'), seat('grok'), null, null]), [
    { seat: 0, kind: 'changed' },
    { seat: 1, kind: 'joined' },
  ]);
  assert.deepEqual(motion.observeSeats([seat('meta', true), seat('grok'), null, null]), [{ seat: 0, kind: 'cheered' }]);
  for (let tick = 0; tick < 10; tick++) motion.update();
  assert.ok(motion.pose(0).offsetY > 0);
  assert.equal(motion.pose(1).offsetY, 0);
});

test('every character has its own cheer sound', () => {
  const soundNames = CHARACTERS.map((character) => eventSounds['character-cheered'][character.name]);
  assert.equal(new Set(soundNames).size, CHARACTERS.length);
  for (const soundName of soundNames) assert.ok(soundDefinitions[soundName]?.length > 0);
});
