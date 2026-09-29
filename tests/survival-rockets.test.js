import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCREEN_WIDTH } from '../src/engine/config.js';
import { spritesFor } from './fixtures/recording-context.mjs';
import {
  ROCKET_INTERVAL_TICKS,
  ROCKET_MAX_OFFSET_Y,
  ROCKET_WARNING_TICKS,
  SurvivalScene,
} from '../src/scenes/survival-scene.js';

const idle = { red: { left: false, right: false, jump: false } };

// Keeps the sea away so a long run is not cut short by the player drowning.
function runDryTicks(scene, tickCount, onTick) {
  for (let tick = 0; tick < tickCount; tick++) {
    scene.seaY = Infinity;
    scene.update(idle);
    onTick?.();
  }
}

test('every rocket spawn has a warning that started exactly 60 ticks earlier', () => {
  const scene = new SurvivalScene({ sprites: spritesFor(), seed: 7 });
  const warningStartTickByKey = new Map();
  const seenRockets = new Set();
  const spawns = [];
  runDryTicks(scene, 3000, () => {
    for (const warning of scene.rocketWarnings) {
      warningStartTickByKey.set(`${warning.side}:${warning.y}:${warning.spawnTick}`, warning.startTick);
    }
    for (const rocket of scene.entityGroups.get('rockets')) {
      if (seenRockets.has(rocket)) continue;
      seenRockets.add(rocket);
      spawns.push({ rocket, tick: scene.runTicks });
    }
  });

  assert.equal(spawns.length, Math.floor((3000 - ROCKET_WARNING_TICKS) / ROCKET_INTERVAL_TICKS));
  for (const { rocket, tick } of spawns) {
    const side = rocket.velocityX > 0 ? 'left' : 'right';
    const startTick = warningStartTickByKey.get(`${side}:${rocket.y}:${tick - 1}`);
    assert.equal(tick - 1 - startTick, ROCKET_WARNING_TICKS);
  }
});

test('rockets appear just off an edge, close to the player height', () => {
  const scene = new SurvivalScene({ sprites: spritesFor(), seed: 3 });
  const playerCenterYAtWarning = new Map();
  let checked = 0;
  runDryTicks(scene, 3000, () => {
    const player = scene.players[0];
    for (const warning of scene.rocketWarnings) {
      if (warning.startTick === scene.runTicks - 1) playerCenterYAtWarning.set(warning.y, player.y + player.height / 2);
    }
    for (const rocket of scene.entityGroups.get('rockets')) {
      if (rocket.ticksRemaining !== 239) continue;
      checked++;
      assert.ok(rocket.velocityX > 0 ? rocket.x < 0 : rocket.x + rocket.width > SCREEN_WIDTH);
      assert.ok(Math.abs(rocket.y + rocket.height / 2 - playerCenterYAtWarning.get(rocket.y)) <= ROCKET_MAX_OFFSET_Y);
    }
  });
  assert.ok(checked > 0);
});

test('a rocket hit knocks the player back and emits rocket-exploded', () => {
  const scene = new SurvivalScene({ sprites: spritesFor(), seed: 5 });
  const exploded = [];
  scene.events.on('rocket-exploded', (payload) => exploded.push(payload));
  runDryTicks(scene, ROCKET_INTERVAL_TICKS + ROCKET_WARNING_TICKS + 1);
  const [rocket] = scene.entityGroups.get('rockets');
  const player = scene.players[0];
  rocket.x = player.x;
  rocket.y = player.y;
  scene.seaY = Infinity;
  scene.update(idle);

  assert.equal(exploded.length, 1);
  assert.deepEqual(exploded[0].playerIds, ['red']);
  assert.notEqual(player.knockbackVelocityX, 0);
  assert.equal(scene.entityGroups.get('rockets').length, 0);
});

test('a rocket flies through blocks', () => {
  const scene = new SurvivalScene({ sprites: spritesFor(), seed: 5 });
  runDryTicks(scene, ROCKET_INTERVAL_TICKS + ROCKET_WARNING_TICKS + 1);
  const [rocket] = scene.entityGroups.get('rockets');
  const platform = scene.entityGroups.get('platforms')[0];
  rocket.x = platform.x;
  rocket.y = platform.y;
  const exploded = [];
  scene.events.on('rocket-exploded', (payload) => exploded.push(payload));
  scene.seaY = Infinity;
  scene.update(idle);

  assert.equal(exploded.length, 0);
  assert.equal(rocket.exploded, false);
});

test('the same seed gives the same rocket schedule', () => {
  const schedule = () => {
    const scene = new SurvivalScene({ sprites: spritesFor(), seed: 11 });
    const warnings = [];
    runDryTicks(scene, 1000, () => warnings.push(JSON.stringify(scene.rocketWarnings)));
    return warnings;
  };
  assert.deepEqual(schedule(), schedule());
});
