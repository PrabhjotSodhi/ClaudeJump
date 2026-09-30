import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { arenaLevels } from './fixtures/arena-levels.mjs';

const level = arenaLevels.quarry;
const idle = { left: false, right: false, jump: false };
const GIRDER_TOP = 112;
const GIRDER_LEFT = 272;
const GIRDER_RIGHT = 368;
const FIRST_STEP_TOP = 224;
const SECOND_STEP_TOP = 192;

test('both spawns stand on the second terrace step, mirrored', () => {
  const scene = new VersusScene({ level, startInFightPhase: true, seed: 1 });
  scene.update({ red: idle, blue: idle });
  for (const player of scene.players) {
    assert.equal(player.y + player.height, SECOND_STEP_TOP, `${player.id} stands on the second step`);
  }
  const [red, blue] = scene.players;
  assert.equal(red.x + red.width / 2, 640 - (blue.x + blue.width / 2));
});

// Jump toward the middle holding the key for a full jump, release once, then jump again in the air.
function girderInputs(direction) {
  return Array.from({ length: 90 }, (_, tick) => ({
    left: direction < 0 && tick < 30,
    right: direction > 0 && tick < 30,
    jump: (tick >= 2 && tick < 13) || (tick >= 14 && tick < 28),
  }));
}

for (const [id, direction] of [
  ['red', 1],
  ['blue', -1],
]) {
  test(`${id} reaches the center girder from the first terrace step with a jump and a double jump`, () => {
    const scene = new VersusScene({ level, startInFightPhase: true, seed: 1 });
    const player = scene.players.find((candidate) => candidate.id === id);
    scene.update({ red: idle, blue: idle });
    player.x = id === 'red' ? 212 - player.width / 2 : 640 - 212 - player.width / 2;
    player.y = FIRST_STEP_TOP - player.height;

    let reachedGirder = false;
    for (const input of girderInputs(direction)) {
      scene.update({ red: id === 'red' ? input : idle, blue: id === 'blue' ? input : idle });
      const centerX = player.x + player.width / 2;
      if (player.y + player.height === GIRDER_TOP && centerX > GIRDER_LEFT && centerX < GIRDER_RIGHT) {
        reachedGirder = true;
      }
    }
    assert.ok(reachedGirder, `${id} ended at ${player.x},${player.y}`);
  });
}

test('the girder is the only girder and the last dry spot above the sudden death line', () => {
  assert.equal(level.tiles.filter((tile) => tile.name === 'girder-left').length, 1);
  const dryTops = level.openTops.filter((openTop) => openTop.y < level.suddenDeathLineY);
  assert.deepEqual(dryTops, [{ x: GIRDER_LEFT, y: GIRDER_TOP, width: GIRDER_RIGHT - GIRDER_LEFT, height: 16 }]);
});
