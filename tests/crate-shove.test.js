import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROUND_COUNTDOWN_TICKS as READY_TICKS, SCREEN_WIDTH } from '../src/engine/config.js';
import { Crate, CRATE_HEIGHT, CRATE_WIDTH } from '../src/entities/crate.js';
import { Platform } from '../src/entities/platform.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { harborLevel } from './fixtures/harbor-level.mjs';

const GROUND = new Platform({ x: 0, y: 100, width: 200, height: 16 });

function idle() {
  return { red: { left: false, right: false, jump: false }, blue: { left: false, right: false, jump: false } };
}

function landedCrate(x, y = GROUND.y - CRATE_HEIGHT) {
  const crate = new Crate({ x, y, cardName: 'dash' });
  crate.y = y;
  crate.landed = true;
  return crate;
}

function fightingScene() {
  const scene = new VersusScene({ level: harborLevel });
  for (let tick = 0; tick < READY_TICKS; tick++) scene.update(idle());
  scene.ticksUntilCrateSpawn = 100000;
  return scene;
}

// Puts the crate on the girder in the middle of Harbor, with nothing below it but the sea.
function crateOnGirder(scene, x) {
  const girder = scene.entityGroups.get('platforms').find((platform) => platform.width > 100 && platform.y < 200);
  const crate = landedCrate(x, girder.y - CRATE_HEIGHT);
  scene.entityGroups.clear('crates');
  scene.entityGroups.add('crates', crate);
  return { crate, girder };
}

test('a landed crate that is pushed slides and then stops with friction', () => {
  const crate = landedCrate(50);
  crate.slide(6);

  const positions = [];
  for (let tick = 0; tick < 80; tick++) {
    crate.update([GROUND]);
    positions.push(crate.x);
  }

  assert.ok(positions[0] > 50, 'it moves right away');
  assert.ok(positions[79] > positions[0] + 20, 'it keeps sliding');
  assert.equal(positions[79], positions[70], 'it has come to rest');
  assert.equal(crate.y, GROUND.y - CRATE_HEIGHT, 'it stays on the platform');
  assert.equal(crate.landed, true);
});

test('a crate still in the air cannot be pushed', () => {
  const crate = new Crate({ x: 50, y: 60, cardName: 'dash' });
  assert.equal(crate.slide(6), false);
});

test('a crate that slides past the edge of its platform drops', () => {
  const crate = landedCrate(GROUND.width - CRATE_WIDTH - 2);
  crate.slide(6);
  for (let tick = 0; tick < 6; tick++) crate.update([GROUND]);

  assert.equal(crate.landed, false);
  assert.ok(crate.y > GROUND.y - CRATE_HEIGHT, 'it is falling');
});

test('a shoved crate lands on a platform below it', () => {
  const lower = new Platform({ x: 0, y: 200, width: 400, height: 16 });
  const crate = landedCrate(GROUND.width - CRATE_WIDTH - 2);
  crate.slide(6);
  for (let tick = 0; tick < 60; tick++) crate.update([GROUND, lower]);

  assert.equal(crate.landed, true);
  assert.equal(crate.y, lower.y - CRATE_HEIGHT);
});

test('a shove pushes a landed crate away from the player', () => {
  const scene = fightingScene();
  const { crate, girder } = crateOnGirder(scene, 300);
  const red = scene.players.find((player) => player.id === 'red');
  red.x = crate.x - red.width - 2;
  red.y = girder.y - red.height;
  red.onGround = true;
  red.facing = 1;
  const startX = crate.x;
  const shoves = [];
  scene.events.on('crate-shoved', (event) => shoves.push(event));

  for (let tick = 0; tick < 30; tick++) {
    red.x = Math.min(red.x, crate.x - red.width - 2);
    scene.update({ ...idle(), red: { left: false, right: false, jump: false, action: tick === 0 } });
  }

  assert.ok(crate.x > startX + 10, `crate moved from ${startX} to ${crate.x}`);
  assert.equal(shoves.length, 1);
  assert.equal(shoves[0].directionX, 1);
});

test('a crate pushed off the edge of the girder falls into the sea and is gone', () => {
  const scene = fightingScene();
  const { crate, girder } = crateOnGirder(scene, 300);
  const shelf = new Platform({ x: 560, y: 250, width: 80, height: 16 });
  scene.entityGroups.clear('platforms');
  scene.entityGroups.add('platforms', girder);
  scene.entityGroups.add('platforms', shelf);
  for (const [index, player] of scene.players.entries()) {
    player.x = 570 + index * 30;
    player.y = shelf.y - player.height;
    player.velocityY = 0;
  }
  crate.x = girder.x + girder.width - CRATE_WIDTH - 4;
  crate.slide(10);
  const splashes = [];
  scene.events.on('crate-fell-in-water', (event) => splashes.push(event));

  for (let tick = 0; tick < 120 && scene.entityGroups.get('crates').includes(crate); tick++) {
    scene.update(idle());
  }

  assert.equal(scene.entityGroups.get('crates').includes(crate), false);
  assert.equal(splashes.length, 1);
  assert.equal(splashes[0].y, scene.waterLineY);
  assert.ok(scene.splashes.list.length > 0, 'a splash is drawn');
});

test('a blast slides a landed crate away from the blast', () => {
  const scene = fightingScene();
  const { crate } = crateOnGirder(scene, 300);
  const startX = crate.x;

  scene.resolveBlast(crate.x - 10, crate.y);
  for (let tick = 0; tick < 10; tick++) crate.update(scene.entityGroups.get('platforms'));

  assert.ok(crate.x > startX, 'pushed right, away from a blast on its left');
});

test('a blast far from the crate leaves it alone', () => {
  const scene = fightingScene();
  const { crate } = crateOnGirder(scene, 300);
  const startX = crate.x;

  scene.resolveBlast(crate.x - 200, crate.y);
  for (let tick = 0; tick < 10; tick++) crate.update(scene.entityGroups.get('platforms'));

  assert.equal(crate.x, startX);
});

test('touching a sliding crate still picks up its card', () => {
  const scene = fightingScene();
  const { crate } = crateOnGirder(scene, 300);
  crate.slide(6);
  const blue = scene.players.find((player) => player.id === 'blue');
  blue.x = crate.x + 30;
  blue.y = crate.y - 12;
  const pickups = [];
  scene.events.on('card-picked-up', (event) => pickups.push(event));

  for (let tick = 0; tick < 20 && pickups.length === 0; tick++) scene.update(idle());

  assert.equal(pickups.length, 1);
  assert.equal(scene.entityGroups.get('crates').includes(crate), false);
});

test('a crate wraps across the screen edge like a player', () => {
  const scene = fightingScene();
  const floor = new Platform({ x: -2000, y: 300, width: 5000, height: 16 });
  scene.entityGroups.add('platforms', floor);
  const crate = landedCrate(SCREEN_WIDTH - 20, floor.y - CRATE_HEIGHT);
  scene.entityGroups.clear('crates');
  scene.entityGroups.add('crates', crate);
  crate.slide(10);

  for (let tick = 0; tick < 12; tick++) scene.update(idle());

  assert.ok(crate.x < SCREEN_WIDTH / 4 && crate.x > 0, `crate came back in at x ${crate.x}`);
  assert.equal(crate.landed, true);
});

test('a crate that falls in the sea makes a small splash and ripple', async () => {
  const { EventEmitter } = await import('../src/engine/events.js');
  const { Splashes } = await import('../src/vfx/splash.js');
  const { SeaRipple } = await import('../src/vfx/sea-ripple.js');
  const events = new EventEmitter();
  const splashes = new Splashes();
  splashes.attachCrates(events);
  const seaRipple = new SeaRipple();
  seaRipple.attachCrates(events);

  events.emit('crate-fell-in-water', { x: 100, y: 328 });

  assert.ok(splashes.list.length > 0);
  assert.ok(splashes.list.every((droplet) => droplet.waterLineY === 328));
  assert.ok(seaRipple.speeds.some((speed) => speed !== 0));
});
