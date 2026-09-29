import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spritesFor } from './fixtures/recording-context.mjs';
import { Crab, CRAB_HEIGHT, CRAB_SPEED, CRAB_WIDTH } from '../src/entities/crab.js';
import { CRAB_STOMP_VELOCITY_Y, SurvivalScene } from '../src/scenes/survival-scene.js';
import { TILE_SIZE } from '../src/engine/config.js';

const idle = { red: { left: false, right: false, jump: false } };

function sceneWithOneCrab() {
  const scene = new SurvivalScene({ sprites: spritesFor(), seed: 5 });
  const floor = scene.rows[0];
  const crab = new Crab({ x: 300, y: floor.y - CRAB_HEIGHT, minX: 0, maxX: 620, direction: 1 });
  scene.entityGroups.clear('crabs');
  scene.entityGroups.add('crabs', crab);
  return { scene, crab, floor };
}

test('a crab turns around at the edge of its run', () => {
  const crab = new Crab({ x: 10, y: 0, minX: 0, maxX: 20, direction: 1 });
  let turnedAtX = null;
  for (let tick = 0; tick < 100 && turnedAtX === null; tick++) {
    crab.update();
    if (crab.velocityX < 0) turnedAtX = crab.x;
  }
  assert.ok(turnedAtX > 19 && turnedAtX <= 20);
  for (let tick = 0; tick < 100; tick++) {
    crab.update();
    assert.ok(crab.x >= 0 && crab.x <= 20);
  }
  assert.equal(Math.abs(crab.velocityX), CRAB_SPEED);
});

test('falling onto a crab removes it, bounces the player and emits crab-stomped', () => {
  const { scene, crab } = sceneWithOneCrab();
  const events = [];
  scene.events.on('crab-stomped', (event) => events.push(event));
  const player = scene.players[0];
  player.x = crab.x + 2;
  player.y = crab.y - player.height - 6;
  player.velocityY = 4;
  player.onGround = false;
  for (let tick = 0; tick < 10 && scene.entityGroups.get('crabs').length; tick++) scene.update(idle);
  assert.equal(scene.entityGroups.get('crabs').length, 0);
  assert.equal(events.length, 1);
  assert.equal(player.velocityY, CRAB_STOMP_VELOCITY_Y);
});

test('walking into a crab knocks the player away and emits player-pinched', () => {
  const { scene, crab } = sceneWithOneCrab();
  const events = [];
  scene.events.on('player-pinched', (event) => events.push(event));
  const player = scene.players[0];
  player.x = crab.x - player.width + 4;
  scene.update(idle);
  assert.equal(events.length, 1);
  assert.ok(player.knockbackVelocityX < 0);
  assert.equal(scene.entityGroups.get('crabs').length, 1);
});

test('crabs only spawn on runs at least 4 blocks wide, never on the start floor, and leave with their run', () => {
  const scene = new SurvivalScene({ sprites: spritesFor(), seed: 11 });
  let crabRunCount = 0;
  for (const row of scene.rows) {
    for (const run of row.runs) {
      if (!run.crab) continue;
      crabRunCount++;
      assert.ok(run.width >= 4 * TILE_SIZE);
      assert.notEqual(row, scene.rows[0]);
      assert.ok(run.crab.x >= run.x && run.crab.x + CRAB_WIDTH <= run.x + run.width);
    }
  }
  assert.ok(crabRunCount > 0);
  const crabbedRun = scene.rows.flatMap((row) => row.runs).find((run) => run.crab);
  scene.removeRun(crabbedRun);
  assert.ok(!scene.entityGroups.get('crabs').includes(crabbedRun.crab));
});
