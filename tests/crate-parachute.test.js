import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROUND_COUNTDOWN_TICKS as READY_TICKS } from '../src/engine/config.js';
import { Crate, CRATE_HEIGHT } from '../src/entities/crate.js';
import { Rocket } from '../src/entities/rocket.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { harborLevel } from './fixtures/harbor-level.mjs';

const MARKER_Y = 200;
const platform = { x: 0, y: MARKER_Y + CRATE_HEIGHT, width: 100, height: 8 };

function idle() {
  return { red: { left: false, right: false, jump: false }, blue: { left: false, right: false, jump: false } };
}

// Ticks until the crate lands, popping its parachute after `popAfterTicks` ticks when that is given.
function ticksToLand(popAfterTicks = null) {
  const crate = new Crate({ x: 10, y: MARKER_Y, cardName: 'dash' });
  for (let tick = 1; tick < 500; tick++) {
    crate.update([platform]);
    if (tick === popAfterTicks) assert.equal(crate.popParachute(1, [platform]), true);
    if (crate.landed) return tick;
  }
  throw new Error('the crate never landed');
}

function fallingCrateInScene(scene) {
  const crate = new Crate({ x: 300, y: 250, cardName: 'dash' });
  const platforms = scene.entityGroups.get('platforms');
  for (let tick = 0; tick < 25; tick++) crate.update(platforms);
  assert.equal(crate.isFalling, true);
  scene.entityGroups.clear('crates');
  scene.entityGroups.add('crates', crate);
  return crate;
}

function fightingScene() {
  const scene = new VersusScene({ level: harborLevel });
  for (let tick = 0; tick < READY_TICKS; tick++) scene.update(idle());
  return scene;
}

test('a crate whose parachute is popped lands sooner', () => {
  const unpoppedTicks = ticksToLand();
  const poppedTicks = ticksToLand(20);

  assert.ok(poppedTicks < unpoppedTicks, `popped ${poppedTicks} vs unpopped ${unpoppedTicks}`);
});

test('a crate that is not popped lands on the same tick every time', () => {
  assert.equal(ticksToLand(), 60);
  assert.equal(ticksToLand(), ticksToLand());
});

test('popping moves the landing marker to the sooner landing', () => {
  const crate = new Crate({ x: 10, y: MARKER_Y, cardName: 'dash' });
  for (let tick = 0; tick < 30; tick++) crate.update([platform]);
  const ticksBefore = crate.landing.ticks;

  crate.popParachute(1, [platform]);

  assert.ok(crate.landing.ticks < ticksBefore);
  assert.equal(crate.landing.y, MARKER_Y);
});

test('a crate that has not appeared or has landed has no parachute to pop', () => {
  const waiting = new Crate({ x: 10, y: MARKER_Y, cardName: 'dash' });
  assert.equal(waiting.popParachute(1, [platform]), false);

  const landed = new Crate({ x: 10, y: MARKER_Y, cardName: 'dash' });
  for (let tick = 0; tick < 70; tick++) landed.update([platform]);
  assert.equal(landed.landed, true);
  assert.equal(landed.popParachute(1, [platform]), false);
});

test('a parachute can only be popped once', () => {
  const crate = new Crate({ x: 10, y: MARKER_Y, cardName: 'dash' });
  for (let tick = 0; tick < 30; tick++) crate.update([platform]);
  assert.equal(crate.popParachute(1, [platform]), true);
  assert.equal(crate.popParachute(1, [platform]), false);
});

test('a shove that reaches the parachute pops it and fires an event', () => {
  const scene = fightingScene();
  const crate = fallingCrateInScene(scene);
  const red = scene.players.find((player) => player.id === 'red');
  red.x = crate.x - 30;
  red.y = 100;
  red.onGround = true;
  red.facing = 1;
  const pops = [];
  scene.events.on('crate-parachute-popped', (event) => pops.push(event));

  for (let tick = 0; tick < 30; tick++) {
    crate.y = red.y + red.height / 2 + 4;
    scene.update({ ...idle(), red: { left: false, right: false, jump: false, action: tick === 0 } });
  }

  assert.equal(crate.parachuteAttached, false);
  assert.equal(pops.length, 1);
  assert.equal(pops[0].cause, 'shove');
});

test('a rocket flying through the parachute pops it', () => {
  const scene = fightingScene();
  const crate = fallingCrateInScene(scene);
  const bounds = crate.parachuteBounds;
  scene.entityGroups.add('rockets', new Rocket({ x: bounds.x - 4, y: bounds.y + 2, facing: 1, shooterId: 'blue' }));

  scene.update(idle());

  assert.equal(crate.parachuteAttached, false);
});

test('a blast near the parachute pops it, and one far away does not', () => {
  const scene = fightingScene();
  const crate = fallingCrateInScene(scene);
  const bounds = crate.parachuteBounds;

  scene.resolveBlast(bounds.x + 200, bounds.y);
  assert.equal(crate.parachuteAttached, true);

  scene.resolveBlast(bounds.x + 30, bounds.y);
  assert.equal(crate.parachuteAttached, false);
});
