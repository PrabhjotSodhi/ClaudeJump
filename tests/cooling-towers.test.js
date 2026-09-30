import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { arenaLevels } from './fixtures/arena-levels.mjs';

const level = arenaLevels['cooling-towers'];
const BRIDGE_TOP = 160;
const BRIDGE_LEFT = 240;
const BRIDGE_RIGHT = 400;
const idle = { left: false, right: false, jump: false };

// Walk toward the middle, jump off the ledge, then jump again in the air.
function bridgeInputs(direction) {
  const inputs = [];
  for (let tick = 0; tick < 90; tick++) {
    inputs.push({
      left: direction < 0,
      right: direction > 0,
      jump: (tick >= 10 && tick < 14) || (tick >= 24 && tick < 28),
    });
  }
  return inputs;
}

for (const [id, direction] of [
  ['red', 1],
  ['blue', -1],
]) {
  test(`${id} spawns on the ledge and reaches the bridge with a jump and a double jump`, () => {
    const scene = new VersusScene({ level, startInFightPhase: true, seed: 1 });
    const player = scene.players.find((candidate) => candidate.id === id);
    scene.update({ red: idle, blue: idle });
    assert.equal(player.y + player.height, level.spawns[0].y, 'spawn stands on the ledge');

    let reachedBridge = false;
    for (const input of bridgeInputs(direction)) {
      scene.update({ red: id === 'red' ? input : idle, blue: id === 'blue' ? input : idle });
      const centerX = player.x + player.width / 2;
      if (player.y + player.height === BRIDGE_TOP && centerX > BRIDGE_LEFT && centerX < BRIDGE_RIGHT) {
        reachedBridge = true;
      }
    }
    assert.ok(reachedBridge, `${id} ended at ${player.x},${player.y}`);
  });
}
