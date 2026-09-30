import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  KNOCKOUT_SLOWMO_TICKS,
  KNOCKOUT_ZOOM,
  KNOCKOUT_ZOOM_OUT_TICKS,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
} from '../src/engine/config.js';
import { stateHash } from '../src/engine/state-hash.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { knockoutZoom } from '../src/vfx/knockout-zoom.js';
import { harborLevel } from './fixtures/harbor-level.mjs';
import { ROUND_COUNTDOWN_TICKS as READY_TICKS } from '../src/engine/config.js';

function idle() {
  return { red: { left: false, right: false, jump: false }, blue: { left: false, right: false, jump: false } };
}

function advance(scene, tickCount) {
  for (let tick = 0; tick < tickCount; tick++) scene.update(idle());
}

function fightingScene() {
  const scene = new VersusScene({ level: harborLevel, seed: 1 });
  advance(scene, READY_TICKS);
  return scene;
}

function player(scene, id) {
  return scene.players.find((candidate) => candidate.id === id);
}

function knockOut(scene, ...ids) {
  for (const id of ids) player(scene, id).y = 600;
  advance(scene, 1);
}

test('the round ends later by the slow motion length', () => {
  const scene = fightingScene();
  knockOut(scene, 'red');

  assert.equal(scene.phase, 'knockout');
  assert.equal(scene.wins.blue, 0, 'the point is not scored yet');
  advance(scene, KNOCKOUT_SLOWMO_TICKS - 1);
  assert.equal(scene.phase, 'knockout', 'one tick before the slow motion ends');
  assert.equal(scene.wins.blue, 0);

  advance(scene, 1);
  assert.equal(scene.phase, 'point');
  assert.equal(scene.winnerId, 'blue');
  assert.equal(scene.wins.blue, 1);
});

test('a draw gets the slow motion too', () => {
  const scene = fightingScene();
  knockOut(scene, 'red', 'blue');

  assert.equal(scene.phase, 'knockout');
  advance(scene, KNOCKOUT_SLOWMO_TICKS);
  assert.equal(scene.phase, 'point');
  assert.equal(scene.winnerId, null);
});

test('a player falls the same distance at half speed', () => {
  const slowScene = fightingScene();
  const referenceScene = fightingScene();
  for (const scene of [slowScene, referenceScene]) {
    const blue = player(scene, 'blue');
    blue.x = 300;
    blue.y = -400;
    blue.onGround = false;
  }
  knockOut(slowScene, 'red');
  advance(referenceScene, 1);

  const slowTicks = 40;
  advance(slowScene, slowTicks);
  advance(referenceScene, slowTicks / 2);

  assert.equal(slowScene.phase, 'knockout');
  assert.ok(player(referenceScene, 'blue').y > -400, 'the reference player really fell');
  assert.equal(player(slowScene, 'blue').y, player(referenceScene, 'blue').y);
});

test('two scenes fed the same inputs agree on the state through the slow motion', () => {
  const first = fightingScene();
  const second = fightingScene();
  knockOut(first, 'red');
  knockOut(second, 'red');
  advance(first, 25);
  advance(second, 25);
  assert.equal(stateHash(first), stateHash(second));
});

test('the zoom is a whole 2x crop toward the fallen player, inside the screen', () => {
  const scene = fightingScene();
  assert.deepEqual(knockoutZoom(scene), { factor: 1, originX: 0, originY: 0 });

  player(scene, 'red').x = 4;
  knockOut(scene, 'red');
  for (let tick = 0; tick < KNOCKOUT_SLOWMO_TICKS; tick += 5) {
    const zoom = knockoutZoom(scene);
    assert.equal(zoom.factor, KNOCKOUT_ZOOM);
    assert.ok(Number.isInteger(zoom.originX) && Number.isInteger(zoom.originY), 'the crop starts on a whole pixel');
    assert.ok(zoom.originX >= 0 && zoom.originX <= SCREEN_WIDTH - SCREEN_WIDTH / KNOCKOUT_ZOOM);
    assert.ok(zoom.originY >= 0 && zoom.originY <= SCREEN_HEIGHT - SCREEN_HEIGHT / KNOCKOUT_ZOOM);
    advance(scene, 5);
  }
  assert.equal(knockoutZoom(scene).originX, 0, 'a player at the left edge pins the crop to the left');
});

test('the zoom eases back out after the round ends, then the view is normal again', () => {
  const scene = fightingScene();
  knockOut(scene, 'red');
  advance(scene, KNOCKOUT_SLOWMO_TICKS);
  assert.equal(scene.phase, 'point');
  assert.equal(knockoutZoom(scene).factor, KNOCKOUT_ZOOM);

  advance(scene, KNOCKOUT_ZOOM_OUT_TICKS);
  assert.equal(knockoutZoom(scene).factor, 1);
});
