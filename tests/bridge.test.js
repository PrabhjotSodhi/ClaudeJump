import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCREEN_WIDTH } from '../src/engine/config.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { arenaLevels } from './fixtures/arena-levels.mjs';

const level = arenaLevels.bridge;
const DECK_TOP = 224;
const idle = { left: false, right: false, jump: false };

const deckRuns = level.platforms.filter((platform) => platform.y === DECK_TOP);
const gaps = deckRuns
  .slice(0, -1)
  .map((run, index) => ({ startX: run.x + run.width, endX: deckRuns[index + 1].x }))
  .filter((gap) => gap.endX > gap.startX);

function spawnRedAt(x) {
  const scene = new VersusScene({ level, startInFightPhase: true, seed: 1 });
  const red = scene.players.find((player) => player.id === 'red');
  red.x = x;
  red.y = DECK_TOP - red.height;
  return { scene, red };
}

// Runs right along the deck and holds jump from the moment the player's right edge reaches the last pixel of deck.
function runAcrossGap(gap, { jump }) {
  const { scene, red } = spawnRedAt(gap.startX - 100);
  let jumpHeldTicks = 0;
  for (let tick = 0; tick < 90; tick++) {
    if (jumpHeldTicks > 0 || red.x + red.width >= gap.startX) jumpHeldTicks++;
    scene.update({
      red: { left: false, right: true, jump: jump && jumpHeldTicks > 0 && jumpHeldTicks < 20 },
      blue: idle,
    });
  }
  return red;
}

test('the deck has two or three gaps between girders', () => {
  assert.ok(gaps.length >= 2 && gaps.length <= 3, `found ${gaps.length} gaps`);
});

test('the deck reaches both screen edges at the same height', () => {
  assert.equal(deckRuns[0].x, 0);
  assert.equal(deckRuns.at(-1).x + deckRuns.at(-1).width, SCREEN_WIDTH);
});

test('every deck gap can be cleared with a running jump', () => {
  for (const gap of gaps) {
    const red = runAcrossGap(gap, { jump: true });
    assert.equal(red.y + red.height, DECK_TOP, `landed on the deck after the gap at ${gap.startX}`);
    assert.ok(red.x >= gap.endX - red.width, `crossed the gap at ${gap.startX}, ended at ${red.x}`);
  }
});

test('running into a deck gap without jumping falls below the deck', () => {
  for (const gap of gaps) {
    const red = runAcrossGap(gap, { jump: false });
    assert.ok(red.y + red.height > DECK_TOP, `fell at the gap at ${gap.startX}`);
  }
});

test('a player can run across the seam along the deck without falling', () => {
  const { scene, red } = spawnRedAt(SCREEN_WIDTH - 100);
  let wrapped = false;
  let previousX = red.x;
  for (let tick = 0; tick < 60; tick++) {
    scene.update({ red: { left: false, right: true, jump: false }, blue: idle });
    wrapped ||= red.x < previousX;
    previousX = red.x;
    assert.equal(red.y + red.height, DECK_TOP, `tick ${tick} x ${red.x}`);
  }
  assert.ok(wrapped, 'the player crossed the seam');
});

test('spawns are mirror images and start on stone piers', () => {
  const [red, blue] = level.spawns;
  assert.equal(red.x, SCREEN_WIDTH - blue.x);
  for (const spawn of [red, blue]) {
    const pier = level.blocks.find(
      (block) => block.y === spawn.y && block.x <= spawn.x - 12 && spawn.x + 12 <= block.x + block.size,
    );
    assert.ok(pier, `${spawn.id} starts on stone`);
  }
});

test('the deck girders never break and only the stone piers do', () => {
  for (const block of level.blocks) {
    assert.ok(block.y >= DECK_TOP, 'no breakable block above the deck');
    assert.ok(block.tile.name.startsWith('block-'));
  }
  assert.equal(level.blocks.length, 4);
});

test('a short girder hangs higher than the deck in the middle', () => {
  const girder = level.platforms.find((platform) => platform.y < DECK_TOP);
  const middleDeck = deckRuns.find((run) => run.x < SCREEN_WIDTH / 2 && SCREEN_WIDTH / 2 < run.x + run.width);
  assert.ok(girder.width < middleDeck.width, 'shorter than the deck run below it');
  assert.equal(girder.x + girder.width / 2, SCREEN_WIDTH / 2);
});
