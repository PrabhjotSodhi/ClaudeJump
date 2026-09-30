import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GOLDEN_PICKUP_USES, PICKUP_USES } from '../src/cards/card-definitions.js';
import { KNOCKOUT_SLOWMO_TICKS, TICK_RATE } from '../src/engine/config.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { drawHeldCardIcons } from '../src/ui/held-card-icons.js';
import { harborLevel } from './fixtures/harbor-level.mjs';
import { recordingContext } from './fixtures/recording-context.mjs';

const IDLE = { left: false, right: false, jump: false };
const NO_INPUT = { red: IDLE, blue: IDLE };
const ROUND_TICKS_BEFORE_SEA_RISES = 1800;

function harborFight(seed = 1) {
  return new VersusScene({ level: harborLevel, startInFightPhase: true, seed });
}

function player(scene, id) {
  return scene.players.find((candidate) => candidate.id === id);
}

// Plays the fight for `tickCount` ticks, clearing each crate the moment it appears so the next one is scheduled.
// Returns each crate that appeared, { golden, cardName, x, fightTick }.
function watchCrates(scene, tickCount) {
  const crates = [];
  for (let tick = 0; tick < tickCount; tick++) {
    scene.update(NO_INPUT);
    const [crate] = scene.entityGroups.get('crates');
    if (!crate) continue;

    crates.push({ golden: crate.golden, cardName: crate.cardName, x: crate.x, fightTick: scene.fightTicks });
    scene.entityGroups.remove('crates', crate);
    scene.scheduleNextCrate();
  }
  return crates;
}

function nextCrate(scene) {
  for (let tick = 0; tick < 1000 && scene.entityGroups.get('crates').length === 0; tick++) scene.update(NO_INPUT);
  return scene.entityGroups.get('crates')[0];
}

function takeCrate(scene, crate) {
  const red = player(scene, 'red');
  crate.landed = true;
  crate.y = crate.markerY;
  red.x = crate.x;
  red.y = crate.y;
  scene.update(NO_INPUT);
}

test('crates before 20 seconds are plain and exactly one crate after is golden', () => {
  const crates = watchCrates(harborFight(), ROUND_TICKS_BEFORE_SEA_RISES);
  const golden = crates.filter((crate) => crate.golden);
  assert.equal(golden.length, 1);
  assert.ok(crates.length > 5);
  assert.ok(golden[0].fightTick >= 20 * TICK_RATE, 'the golden crate is not early');
  for (const crate of crates.filter((candidate) => candidate.fightTick < 20 * TICK_RATE)) {
    assert.equal(crate.golden, false);
  }
  assert.equal(
    crates.indexOf(golden[0]),
    crates.findIndex((crate) => crate.fightTick >= 20 * TICK_RATE),
  );
});

test('every round gets its own golden crate', () => {
  const scene = harborFight();
  watchCrates(scene, ROUND_TICKS_BEFORE_SEA_RISES);
  scene.entityGroups.clear('crates');
  player(scene, 'blue').y = 600;
  for (let tick = 0; tick < 1 + KNOCKOUT_SLOWMO_TICKS && scene.phase === 'fight'; tick++) scene.update(NO_INPUT);
  for (let tick = 0; tick < 600 && scene.phase !== 'fight'; tick++) scene.update(NO_INPUT);
  assert.equal(scene.phase, 'fight');
  assert.equal(scene.wins.red, 1);
  const secondRound = watchCrates(scene, ROUND_TICKS_BEFORE_SEA_RISES);
  assert.equal(secondRound.filter((crate) => crate.golden).length, 1);
});

test('a golden crate gives two uses and a plain crate gives one', () => {
  const plainScene = harborFight();
  takeCrate(plainScene, nextCrate(plainScene));
  assert.equal(player(plainScene, 'red').heldCardUsesRemaining, PICKUP_USES);
  assert.equal(PICKUP_USES, 1);

  const scene = harborFight();
  watchCrates(scene, 20 * TICK_RATE - 1);
  const crate = nextCrate(scene);
  assert.equal(crate.golden, true);
  const pickups = [];
  scene.events.on('card-picked-up', (event) => pickups.push(event));
  takeCrate(scene, crate);
  const red = player(scene, 'red');
  assert.equal(pickups.length, 1);
  assert.equal(pickups[0].golden, true);
  assert.equal(red.heldCardUsesRemaining, GOLDEN_PICKUP_USES);
  assert.equal(GOLDEN_PICKUP_USES, 2);

  const played = [];
  scene.events.on('card-played', (event) => played.push(event.cardName));
  const press = { red: { ...IDLE, action: true }, blue: IDLE };
  scene.update(press);
  scene.update(NO_INPUT);
  assert.equal(red.heldCardUsesRemaining, 1);
  assert.ok(red.heldCardName, 'the card is still held after the first use');
  scene.update(press);
  assert.equal(played.length, 2);
  assert.equal(red.heldCardName, null);
});

test('the same seed gives the same golden crate', () => {
  const first = watchCrates(harborFight(9), ROUND_TICKS_BEFORE_SEA_RISES);
  const second = watchCrates(harborFight(9), ROUND_TICKS_BEFORE_SEA_RISES);
  assert.deepEqual(first, second);
});

test('the held card icon shows how many uses are left', () => {
  const scene = harborFight();
  const red = player(scene, 'red');
  red.receiveCard('rocket', 1);
  const oneUse = recordingContext();
  drawHeldCardIcons(oneUse, scene);
  red.heldCardName = null;
  red.receiveCard('rocket', 2);
  const twoUses = recordingContext();
  drawHeldCardIcons(twoUses, scene);
  assert.ok(twoUses.drawnImages.length > oneUse.drawnImages.length, 'the count is drawn');
});
