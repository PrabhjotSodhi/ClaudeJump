import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BRIDGE_PLANK_CRACK_INTERVAL_TICKS,
  BRIDGE_PLANK_CRACK_TICKS,
  KNOCKOUT_SLOWMO_TICKS,
  TICK_RATE,
} from '../src/engine/config.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { arenaLevels } from './fixtures/arena-levels.mjs';

const IDLE = { left: false, right: false, jump: false };
const NO_INPUT = { red: IDLE, blue: IDLE };
const DECK_ROW = 14;
const PLANK_COLUMNS = [0, 1, 2, 3, 6, 7, 8, 9, 10, 16, 17, 18, 19, 20, 21, 22, 23, 29, 30, 31, 32, 33, 36, 37, 38, 39];

function bridgeFight(seed = 1) {
  return new VersusScene({ level: arenaLevels.bridge, startInFightPhase: true, seed });
}

function deck(scene) {
  return scene.entityGroups.get('hazards')[0];
}

function player(scene, id) {
  return scene.players.find((candidate) => candidate.id === id);
}

function advance(scene, tickCount) {
  for (let tick = 0; tick < tickCount; tick++) scene.update(NO_INPUT);
}

// The columns in the order their planks start cracking, read by watching the deck for `tickCount` ticks.
function crackOrder(seed, tickCount = 1800) {
  const scene = bridgeFight(seed);
  const order = [];
  const seen = new Set();
  for (let tick = 0; tick < tickCount; tick++) {
    scene.update(NO_INPUT);
    for (const plank of deck(scene).planks) {
      if (plank.state !== 'solid' && !seen.has(plank.column)) {
        seen.add(plank.column);
        order.push(plank.column);
      }
    }
  }
  return order;
}

function isSolid(scene, column) {
  return scene.solidCells[DECK_ROW][column];
}

test('Bridge has a plank for every girder cell of its deck', () => {
  const scene = bridgeFight();
  assert.deepEqual(
    deck(scene).planks.map((plank) => plank.column),
    PLANK_COLUMNS,
  );
  assert.ok(PLANK_COLUMNS.every((column) => isSolid(scene, column)));
});

test('no plank cracks before 15 seconds, then one starts at 15 seconds', () => {
  const scene = bridgeFight();
  advance(scene, 15 * TICK_RATE - 1);
  assert.ok(deck(scene).planks.every((plank) => plank.state === 'solid'));
  advance(scene, 1);
  assert.equal(deck(scene).planks.filter((plank) => plank.state === 'cracking').length, 1);
});

test('planks start cracking one at a time, three quarters of a second apart', () => {
  const scene = bridgeFight();
  const started = () => deck(scene).planks.filter((plank) => plank.state !== 'solid').length;
  advance(scene, 15 * TICK_RATE);
  assert.equal(started(), 1);
  advance(scene, 44);
  assert.equal(started(), 1);
  advance(scene, 1);
  assert.equal(started(), 2);
  advance(scene, 45);
  assert.equal(started(), 3);
});

test('a plank cracks for a full second while still solid, then falls out of the deck', () => {
  const scene = bridgeFight();
  advance(scene, 15 * TICK_RATE);
  const plank = deck(scene).planks.find((candidate) => candidate.state === 'cracking');
  assert.equal(BRIDGE_PLANK_CRACK_TICKS, TICK_RATE);
  const tile = arenaLevels.bridge.tiles.find(
    (candidate) =>
      candidate.name.startsWith('girder') && candidate.x === plank.column * 16 && candidate.y === DECK_ROW * 16,
  );
  assert.equal(
    scene.brokenTiles.has(tile),
    true,
    'the deck stops drawing the plank so the shaking copy is the only one',
  );
  for (let tick = 1; tick < TICK_RATE; tick++) {
    scene.update(NO_INPUT);
    assert.equal(plank.state, 'cracking');
    assert.equal(isSolid(scene, plank.column), true, `still solid ${tick} ticks into the crack`);
  }
  scene.update(NO_INPUT);
  assert.equal(plank.state, 'falling');
  assert.equal(isSolid(scene, plank.column), false);
});

test('a player standing on a plank falls when it goes', () => {
  const scene = bridgeFight();
  const lastPlankBeforeGap = deck(scene).planks.findIndex((plank) => plank.column === 10);
  deck(scene).crackOrder = [
    lastPlankBeforeGap,
    ...deck(scene).crackOrder.filter((index) => index !== lastPlankBeforeGap),
  ];
  const red = player(scene, 'red');
  const standOnPlank = () => {
    red.x = 10 * 16;
    red.y = DECK_ROW * 16 - red.height;
  };
  for (let tick = 0; tick < 15 * TICK_RATE + TICK_RATE - 1; tick++) {
    standOnPlank();
    scene.update(NO_INPUT);
  }
  assert.equal(red.onGround, true, 'red stands on the cracking plank');
  scene.update(NO_INPUT);
  advance(scene, 20);
  assert.ok(red.y > DECK_ROW * 16, 'red dropped through the gap');
});

test('the plank order is the same for the same seed and differs between seeds', () => {
  const order = crackOrder(5);
  assert.ok(order.length > 15);
  assert.deepEqual(crackOrder(5), order);
  assert.notDeepEqual(crackOrder(6), order);
});

test('every plank can fall, each once', () => {
  const order = crackOrder(3, 15 * TICK_RATE + 26 * BRIDGE_PLANK_CRACK_INTERVAL_TICKS + 2 * TICK_RATE);
  assert.deepEqual(
    [...order].sort((first, second) => first - second),
    PLANK_COLUMNS,
  );
});

test('fallen planks are back next round and every spawn has ground under it', () => {
  const scene = bridgeFight();
  advance(scene, 15 * TICK_RATE + 6 * BRIDGE_PLANK_CRACK_INTERVAL_TICKS + 2 * TICK_RATE);
  assert.ok(
    PLANK_COLUMNS.some((column) => !isSolid(scene, column)),
    'some planks have fallen',
  );

  player(scene, 'blue').y = 600;
  advance(scene, 1 + KNOCKOUT_SLOWMO_TICKS + 90);
  assert.equal(scene.phase, 'ready');
  assert.ok(
    PLANK_COLUMNS.every((column) => isSolid(scene, column)),
    'every plank is back',
  );
  assert.ok(deck(scene).planks.every((plank) => plank.state === 'solid'));
  for (const { id } of scene.joinedPlayers) {
    const spawn = arenaLevels.bridge.spawns.find((candidate) => candidate.id === id);
    const cell = Math.floor(spawn.x / 16);
    assert.ok(scene.solidCells[DECK_ROW][cell] || scene.solidCells[DECK_ROW][cell - 1], `${id} has ground`);
  }
});
