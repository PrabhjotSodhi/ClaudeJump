import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HITSTOP_TICKS } from '../src/engine/config.js';
import { Bomb } from '../src/entities/bomb.js';
import { Rocket } from '../src/entities/rocket.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { harborLevel } from './fixtures/harbor-level.mjs';

const READY_TICKS = 60;

function input(overrides = {}) {
  return { left: false, right: false, jump: false, action: false, ...overrides };
}

function advance(scene, tickCount, inputs = { red: input(), blue: input() }) {
  for (let tick = 0; tick < tickCount; tick++) scene.update(inputs);
}

function fightingScene() {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  return scene;
}

function player(scene, id) {
  return scene.players.find((candidate) => candidate.id === id);
}

// Red faces blue with blue inside the shove zone, and the action key released so the next press fires.
function shoveSetup() {
  const scene = fightingScene();
  const red = player(scene, 'red');
  const blue = player(scene, 'blue');
  red.x = 264;
  red.y = 116;
  red.onGround = true;
  red.facing = 1;
  blue.x = 300;
  blue.y = 116;
  blue.onGround = true;
  advance(scene, 1);
  return { scene, red, blue };
}

function shove(scene) {
  scene.update({ red: input({ action: true }), blue: input() });
}

// Ticks the player stays exactly where they were when the hit landed.
function ticksHeldStill(scene, hitPlayer) {
  const frozenX = hitPlayer.x;
  let heldTicks = 0;
  while (hitPlayer.x === frozenX && heldTicks < 20) {
    advance(scene, 1);
    heldTicks++;
  }
  return heldTicks - 1;
}

test('a shove freezes both players for the light freeze, then launches the one hit', () => {
  const { scene, red, blue } = shoveSetup();
  shove(scene);
  const redFrozenX = red.x;
  const blueFrozen = { x: blue.x, y: blue.y };

  for (let tick = 0; tick < HITSTOP_TICKS.light; tick++) {
    assert.deepEqual({ x: blue.x, y: blue.y }, blueFrozen, `blue holds still on freeze tick ${tick}`);
    assert.equal(red.x, redFrozenX, `red holds still on freeze tick ${tick}`);
    scene.update({ red: input({ right: true, jump: true }), blue: input({ left: true, jump: true }) });
  }

  scene.update({ red: input(), blue: input() });
  assert.ok(blue.x > blueFrozen.x, 'blue launches once the freeze ends');
  assert.ok(blue.y < blueFrozen.y, 'blue pops upward once the freeze ends');
});

test('a frozen player ignores input and is not pulled by gravity', () => {
  const { scene, blue } = shoveSetup();
  shove(scene);
  blue.onGround = false;
  blue.velocityY = 3;
  const frozenY = blue.y;

  advance(scene, HITSTOP_TICKS.light - 1, { red: input(), blue: input({ left: true, jump: true, action: true }) });

  assert.equal(blue.y, frozenY);
  assert.equal(blue.velocityY, 3);
  assert.equal(blue.isShoveActive, false, 'the shove key pressed during the freeze does not fire');
});

test('the round timer and other projectiles keep moving while two players are frozen', () => {
  const { scene } = shoveSetup();
  const rocket = new Rocket({ x: 40, y: 200, facing: 1, shooterId: 'red' });
  scene.entityGroups.add('rockets', rocket);
  shove(scene);
  const fightTicks = scene.fightTicks;
  const rocketX = rocket.x;

  advance(scene, HITSTOP_TICKS.light);

  assert.equal(scene.fightTicks, fightTicks + HITSTOP_TICKS.light);
  assert.ok(rocket.x > rocketX, 'a projectile away from the hit flies on');
});

test('a dash hit holds the player still for longer than a shove does', () => {
  const shoveScene = shoveSetup();
  shove(shoveScene.scene);
  const shoveTicks = ticksHeldStill(shoveScene.scene, shoveScene.blue);

  const scene = fightingScene();
  const red = player(scene, 'red');
  const blue = player(scene, 'blue');
  red.x = 264;
  red.y = 116;
  red.onGround = true;
  red.facing = 1;
  red.dashTicksRemaining = 10;
  blue.x = 300;
  blue.y = 116;
  blue.onGround = true;
  const hits = [];
  scene.events.on('dash-hit', (event) => hits.push(event));
  while (hits.length === 0) advance(scene, 1);
  const dashTicks = ticksHeldStill(scene, blue);

  assert.equal(shoveTicks, HITSTOP_TICKS.light);
  assert.equal(dashTicks, HITSTOP_TICKS.medium);
  assert.ok(dashTicks > shoveTicks);
});

test('a rocket hit freezes the rocket, the shooter and the player, then the blast launches them', () => {
  const scene = fightingScene();
  const red = player(scene, 'red');
  const blue = player(scene, 'blue');
  red.x = 100;
  red.y = 116;
  blue.x = 300;
  blue.y = 116;
  blue.onGround = true;
  const rocket = new Rocket({ x: 270, y: 124, facing: 1, shooterId: 'red' });
  scene.entityGroups.add('rockets', rocket);
  const explosions = [];
  scene.events.on('rocket-exploded', (event) => explosions.push(event));

  while (!rocket.exploded) advance(scene, 1);
  const frozenRocketX = rocket.x;
  const frozenBlueX = blue.x;
  const frozenRedX = red.x;

  for (let tick = 1; tick < HITSTOP_TICKS.heavy; tick++) {
    advance(scene, 1);
    assert.equal(rocket.x, frozenRocketX, 'the rocket hangs in place');
    assert.equal(blue.x, frozenBlueX, 'the player hit holds still');
    assert.equal(red.x, frozenRedX, 'the shooter holds still');
    assert.equal(blue.knockbackVelocityX, 0, 'no knockback yet');
    assert.equal(explosions.length, 0);
  }

  advance(scene, 1);
  assert.equal(explosions.length, 1);
  assert.equal(explosions[0].strength, 'heavy');
  advance(scene, 1);
  assert.ok(blue.x > frozenBlueX, 'the launch starts when the freeze ends');
});

test('a bomb hit freezes the player before the blast launches them', () => {
  const scene = fightingScene();
  const blue = player(scene, 'blue');
  blue.x = 300;
  blue.y = 116;
  blue.onGround = true;
  const bomb = new Bomb({ x: 300, y: 118, facing: 1, throwerId: 'red' });
  bomb.velocityX = 0;
  bomb.velocityY = 0;
  scene.entityGroups.add('bombs', bomb);

  advance(scene, 1);
  const frozenX = blue.x;
  advance(scene, HITSTOP_TICKS.heavy - 1);
  assert.equal(blue.x, frozenX);
  assert.equal(blue.knockbackVelocityX, 0);
  advance(scene, 2);
  assert.notEqual(blue.x, frozenX);
});
