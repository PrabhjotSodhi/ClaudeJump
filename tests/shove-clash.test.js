import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SHOVE_CLASH_BOUNCE_VELOCITY_X,
  SHOVE_CLASH_WIN_KNOCKBACK_MULTIPLIER,
  SHOVE_MAX_CHARGE_TICKS,
  SHOVE_WINDUP_TICKS,
} from '../src/engine/config.js';
import { CHARACTERS } from '../src/entities/characters.js';
import { SHOVE_KNOCKBACK_VELOCITY_X } from '../src/entities/player.js';
import { PLAYERS } from '../src/levels/versus-arena.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { harborLevel } from './fixtures/harbor-level.mjs';
import { ROUND_COUNTDOWN_TICKS as READY_TICKS } from '../src/engine/config.js';

const TAP_HOLD_TICKS = 1;
const FIRE_TICK = SHOVE_MAX_CHARGE_TICKS + 5;

function input(overrides = {}) {
  return { left: false, right: false, jump: false, action: false, ...overrides };
}

function find(scene, id) {
  return scene.players.find((candidate) => candidate.id === id);
}

// A shove fires on the tick the button is released, but never before the wind-up is done. This presses so that the
// shove starts on FIRE_TICK whatever the hold.
function isHolding(tick, holdTicks, delayTicks) {
  const pressTick = FIRE_TICK + delayTicks - Math.max(holdTicks, SHOVE_WINDUP_TICKS + 1);
  return tick >= pressTick && tick < pressTick + holdTicks;
}

function face(leftPlayer, rightPlayer) {
  leftPlayer.x = 264;
  leftPlayer.y = 116;
  leftPlayer.onGround = true;
  leftPlayer.facing = 1;
  rightPlayer.x = 300;
  rightPlayer.y = 116;
  rightPlayer.onGround = true;
  rightPlayer.facing = -1;
}

// Two players face each other in shove range. Each holds the action key for its own number of ticks, and the
// shoves are timed to start on the same tick. A hold of 0 means that player does not shove.
function clash({
  leftId = 'red',
  rightId = 'blue',
  leftHoldTicks,
  rightHoldTicks,
  rightDelayTicks = 0,
  playerCount = 2,
}) {
  const players = PLAYERS.slice(0, playerCount).map(({ id }, index) => ({ id, character: CHARACTERS[index] }));
  const scene = new VersusScene({ level: harborLevel, seed: 0, players });
  const idle = () => Object.fromEntries(scene.players.map((player) => [player.id, input()]));
  for (let tick = 0; tick < READY_TICKS; tick++) scene.update(idle());
  const left = find(scene, leftId);
  const right = find(scene, rightId);
  face(left, right);
  scene.update(idle());

  const clashes = [];
  const shoves = [];
  scene.events.on('shove-clash', (event) => clashes.push(event));
  scene.events.on('player-shoved', (event) => shoves.push(event));
  const start = { leftX: left.x, rightX: right.x };
  const peakSpeed = { left: 0, right: 0 };
  for (let tick = 0; tick < FIRE_TICK + 70; tick++) {
    const inputs = idle();
    inputs[leftId] = input({ action: isHolding(tick, leftHoldTicks, 0) });
    inputs[rightId] = input({ action: isHolding(tick, rightHoldTicks, rightDelayTicks) });
    scene.update(inputs);
    peakSpeed.left = Math.max(peakSpeed.left, Math.abs(left.knockbackVelocityX));
    peakSpeed.right = Math.max(peakSpeed.right, Math.abs(right.knockbackVelocityX));
  }
  return { scene, left, right, clashes, shoves, start, peakSpeed };
}

test('two equal shoves cancel: both bounce apart and neither is launched', () => {
  const { left, right, clashes, shoves, start, peakSpeed } = clash({
    leftHoldTicks: TAP_HOLD_TICKS,
    rightHoldTicks: TAP_HOLD_TICKS,
  });

  assert.equal(clashes.length, 1);
  assert.deepEqual(clashes[0].playerIds, ['red', 'blue']);
  assert.equal(shoves.length, 0, 'no shove lands');
  assert.ok(left.x < start.leftX, 'red bounced left');
  assert.ok(right.x > start.rightX, 'blue bounced right');
  assert.equal(peakSpeed.left, SHOVE_CLASH_BOUNCE_VELOCITY_X);
  assert.equal(peakSpeed.right, SHOVE_CLASH_BOUNCE_VELOCITY_X);
  assert.ok(peakSpeed.left < SHOVE_KNOCKBACK_VELOCITY_X, 'a bounce is gentler than a hit');
  assert.equal(left.inWater || right.inWater, false);
});

test('the clash event sits between the two players', () => {
  const { clashes } = clash({ leftHoldTicks: TAP_HOLD_TICKS, rightHoldTicks: TAP_HOLD_TICKS });

  assert.ok(clashes[0].x > 264 && clashes[0].x < 300 + 32);
  assert.ok(clashes[0].y > 116 && clashes[0].y < 116 + 40);
});

test('a full charge beats a tap with less knockback than a clean hit', () => {
  const { left, right, clashes, shoves, start } = clash({
    leftHoldTicks: SHOVE_MAX_CHARGE_TICKS + 1,
    rightHoldTicks: TAP_HOLD_TICKS,
  });

  assert.equal(clashes.length, 1);
  assert.equal(shoves.length, 1, 'only the charged shove lands');
  assert.equal(shoves[0].shoverId, 'red');
  assert.equal(shoves[0].targetId, 'blue');
  assert.ok(right.x > start.rightX, 'blue is pushed away');
  assert.ok(left.x >= start.leftX, 'red is not pushed back');
});

test('a charged winner knocks back less than the same shove with no clash', () => {
  const clashed = clash({ leftHoldTicks: SHOVE_MAX_CHARGE_TICKS + 1, rightHoldTicks: TAP_HOLD_TICKS });
  const clean = clash({ leftHoldTicks: SHOVE_MAX_CHARGE_TICKS + 1, rightHoldTicks: 0 });

  assert.equal(clean.clashes.length, 0);
  assert.equal(clashed.peakSpeed.right, clean.peakSpeed.right * SHOVE_CLASH_WIN_KNOCKBACK_MULTIPLIER);
});

test('a clash works between any pair among four players', () => {
  const { clashes, shoves } = clash({
    leftId: 'green',
    rightId: 'yellow',
    leftHoldTicks: TAP_HOLD_TICKS,
    rightHoldTicks: TAP_HOLD_TICKS,
    playerCount: 4,
  });

  assert.equal(clashes.length, 1);
  assert.deepEqual(clashes[0].playerIds, ['green', 'yellow']);
  assert.equal(shoves.length, 0);
});

test('the same inputs give the same clash', () => {
  const first = clash({ leftHoldTicks: 10, rightHoldTicks: 10 });
  const second = clash({ leftHoldTicks: 10, rightHoldTicks: 10 });

  assert.deepEqual([first.left.x, first.right.x], [second.left.x, second.right.x]);
  assert.deepEqual(first.clashes, second.clashes);
});

test('presses 2 ticks apart still clash', () => {
  const { clashes, shoves } = clash({
    leftHoldTicks: TAP_HOLD_TICKS,
    rightHoldTicks: TAP_HOLD_TICKS,
    rightDelayTicks: 2,
  });

  assert.equal(clashes.length, 1);
  assert.equal(shoves.length, 0, 'neither shove lands');
});

test('presses 4 ticks apart are a clean hit for the first shove', () => {
  const { clashes, shoves, right, start } = clash({
    leftHoldTicks: TAP_HOLD_TICKS,
    rightHoldTicks: TAP_HOLD_TICKS,
    rightDelayTicks: 4,
  });

  assert.equal(clashes.length, 0);
  assert.equal(shoves.length, 1);
  assert.equal(shoves[0].shoverId, 'red');
  assert.ok(right.x > start.rightX);
});
