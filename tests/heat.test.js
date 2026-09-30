import assert from 'node:assert/strict';
import { test } from 'node:test';
import { knockBackPlayersInBlast } from '../src/engine/blast.js';
import {
  HEAT_KNOCKBACK_MAX_MULTIPLIER,
  HEAT_KNOCKBACK_STEP,
  ROUND_COUNTDOWN_TICKS as READY_TICKS,
  SHOVE_WINDUP_TICKS,
} from '../src/engine/config.js';
import { stateHash } from '../src/engine/state-hash.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { harborLevel } from './fixtures/harbor-level.mjs';

const SHOVE_COOLDOWN_AND_FREEZE_TICKS = 40;
const FLIGHT_TICKS = 12;

function input(overrides = {}) {
  return { left: false, right: false, jump: false, action: false, ...overrides };
}

function advance(scene, tickCount) {
  for (let tick = 0; tick < tickCount; tick++) scene.update({ red: input(), blue: input() });
}

function player(scene, id) {
  return scene.players.find((candidate) => candidate.id === id);
}

function fightingScene(heat) {
  const scene = new VersusScene({ level: harborLevel, seed: 1, heat });
  advance(scene, READY_TICKS);
  return scene;
}

// Red shoves blue from the same spot every time. Returns how far blue flew in the ticks after the freeze.
function shoveBlueAndMeasure(scene) {
  const red = player(scene, 'red');
  const blue = player(scene, 'blue');
  advance(scene, SHOVE_COOLDOWN_AND_FREEZE_TICKS);
  Object.assign(red, { x: 264, y: 116, onGround: true, facing: 1, velocityX: 0, velocityY: 0 });
  Object.assign(blue, { x: 300, y: 116, onGround: true, velocityX: 0, velocityY: 0, knockbackVelocityX: 0 });
  advance(scene, 1);
  scene.update({ red: input({ action: true }), blue: input() });
  advance(scene, SHOVE_WINDUP_TICKS + 1);
  const startX = 300;
  advance(scene, FLIGHT_TICKS);
  return blue.x - startX;
}

test('with heat on, the third hit launches further than the first', () => {
  const scene = fightingScene(true);
  const distances = [1, 2, 3].map(() => shoveBlueAndMeasure(scene));

  assert.ok(distances[1] > distances[0], 'the second hit goes further than the first');
  assert.ok(distances[2] > distances[1], 'the third hit goes further than the second');
});

test('with heat off, every hit launches the same distance', () => {
  const scene = fightingScene(false);
  const distances = [1, 2, 3].map(() => shoveBlueAndMeasure(scene));

  assert.equal(distances[1], distances[0]);
  assert.equal(distances[2], distances[0]);
});

test('the heat cap holds however many hits a player takes', () => {
  const scene = fightingScene(true);
  const stepsToCap = Math.ceil((HEAT_KNOCKBACK_MAX_MULTIPLIER - 1) / HEAT_KNOCKBACK_STEP);
  const distances = Array.from({ length: stepsToCap + 3 }, () => shoveBlueAndMeasure(scene));

  const cappedDistance = distances[stepsToCap];
  assert.ok(cappedDistance > distances[0], 'heat did grow the launch');
  assert.equal(distances[stepsToCap + 1], cappedDistance);
  assert.equal(distances[stepsToCap + 2], cappedDistance);
});

test('heat resets at the start of the next round', () => {
  const scene = fightingScene(true);
  const firstHit = shoveBlueAndMeasure(scene);
  shoveBlueAndMeasure(scene);
  shoveBlueAndMeasure(scene);

  player(scene, 'red').y = 600;
  for (let tick = 0; tick < 600 && scene.phase !== 'ready'; tick++) advance(scene, 1);
  assert.equal(scene.phase, 'ready');
  advance(scene, READY_TICKS);
  assert.equal(scene.phase, 'fight');

  assert.equal(shoveBlueAndMeasure(scene), firstHit);
});

test('a blast counts as a hit and hits harder with heat', () => {
  const scene = fightingScene(true);
  const blue = player(scene, 'blue');
  const blastX = blue.x - 10;
  const blastY = blue.y + blue.height / 2;

  knockBackPlayersInBlast([blue], blastX, blastY);
  const firstLaunch = blue.knockbackVelocityX;
  blue.knockbackVelocityX = 0;
  knockBackPlayersInBlast([blue], blastX, blastY);

  assert.ok(blue.knockbackVelocityX > firstLaunch);
});

test('two scenes with heat on, fed the same inputs, keep the same state', () => {
  const first = fightingScene(true);
  const second = fightingScene(true);
  for (const scene of [first, second]) {
    shoveBlueAndMeasure(scene);
    shoveBlueAndMeasure(scene);
  }

  assert.equal(stateHash(first), stateHash(second));
});
