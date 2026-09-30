import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCREEN_WIDTH } from '../src/engine/config.js';
import { PhysicsEntity } from '../src/engine/physics-entity.js';
import { Platform } from '../src/entities/platform.js';
import { SurvivalScene } from '../src/scenes/survival-scene.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { arenaLevels } from './fixtures/arena-levels.mjs';

const holdRight = { left: false, right: true, jump: false };
const idle = { left: false, right: false, jump: false };
const LEDGE_TOP_BY_LEVEL = { cave: 160, rooftops: 240, 'server-farm': 160 };

for (const [levelName, ledgeTop] of Object.entries(LEDGE_TOP_BY_LEVEL)) {
  test(`walking right across the seam on ${levelName} keeps the player on the ledge`, () => {
    const scene = new VersusScene({ level: arenaLevels[levelName], startInFightPhase: true, seed: 1 });
    const red = scene.players.find((player) => player.id === 'red');
    red.x = 600;
    red.y = ledgeTop - red.height;

    for (let tick = 0; tick < 20; tick++) {
      scene.update({ red: holdRight, blue: idle });
      assert.equal(red.y + red.height, ledgeTop, `tick ${tick} x ${red.x}`);
    }
    assert.ok(red.x < 100, 'the player wrapped to the far side');
  });
}

test('walking right across the seam on the Survival starting floor keeps the player on the floor', () => {
  const scene = new SurvivalScene({ seed: 12345 });
  const player = scene.players[0];
  const floorTop = 328;

  for (let tick = 0; tick < 300; tick++) {
    scene.update({ red: holdRight });
    assert.ok(player.y + player.height <= floorTop, `tick ${tick} y ${player.y}`);
  }
  assert.equal(player.y + player.height, floorTop);
});

test('a wall across the seam still blocks a walking entity', () => {
  const wall = new Platform({ x: 0, y: 100, width: 32, height: 200 });
  const floor = new Platform({ x: 100, y: 300, width: 440, height: 32 });
  const entity = new PhysicsEntity({ x: 500, y: 272, width: 24, height: 28 });
  entity.velocityX = 4;

  for (let tick = 0; tick < 60; tick++) {
    entity.moveAndCollide([wall, floor]);
    entity.x = ((entity.x % SCREEN_WIDTH) + SCREEN_WIDTH) % SCREEN_WIDTH;
  }

  assert.equal(entity.x, SCREEN_WIDTH - entity.width);
});

test('an entity past the edge is blocked by a wall on the other side of the seam', () => {
  const wall = new Platform({ x: 0, y: 100, width: 32, height: 200 });
  const entity = new PhysicsEntity({ x: 630, y: 150, width: 24, height: 28 });
  entity.velocityX = 4;

  entity.moveAndCollide([wall]);

  assert.equal(entity.x, SCREEN_WIDTH - entity.width);
  assert.equal(entity.velocityX, 0);
});
