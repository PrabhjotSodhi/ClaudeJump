import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CRANE_FIRST_SWING_TICKS,
  CRANE_REST_TICKS,
  CRANE_SWING_TICKS,
  CRANE_WARNING_TICKS,
  TICK_RATE,
} from '../src/engine/config.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { arenaLevels } from './fixtures/arena-levels.mjs';
import { harborLevel } from './fixtures/harbor-level.mjs';

const IDLE = { left: false, right: false, jump: false };
const NO_INPUT = { red: IDLE, blue: IDLE };
const CYCLE_TICKS = CRANE_WARNING_TICKS + CRANE_SWING_TICKS + CRANE_REST_TICKS;

function harborFight() {
  return new VersusScene({ level: harborLevel, startInFightPhase: true, seed: 1 });
}

function craneHook(scene) {
  return scene.entityGroups.get('hazards')[0];
}

function player(scene, id) {
  return scene.players.find((candidate) => candidate.id === id);
}

function advance(scene, tickCount) {
  for (let tick = 0; tick < tickCount; tick++) scene.update(NO_INPUT);
}

function advanceUntil(scene, condition, limit = 3000) {
  for (let tick = 0; tick < limit && !condition(); tick++) scene.update(NO_INPUT);
  assert.ok(condition(), 'the condition was never reached');
}

function standInHook(scene, id) {
  const hook = craneHook(scene);
  const target = player(scene, id);
  target.x = hook.x + hook.width / 2 - target.width / 2;
  target.y = hook.y + hook.height / 2 - target.height / 2;
  return target;
}

test('Harbor has a crane hook and the other arenas do not', () => {
  assert.ok(craneHook(harborFight()));
  const otherArena = new VersusScene({ level: arenaLevels['cooling-towers'], startInFightPhase: true, seed: 1 });
  assert.equal(otherArena.entityGroups.get('hazards').length, 0);
});

test('the hook stays parked for 9 seconds, warns for 1, then swings at 10 seconds', () => {
  const scene = harborFight();
  for (let tick = 1; tick < 10 * TICK_RATE; tick++) {
    scene.update(NO_INPUT);
    const expectedPhase = tick < 9 * TICK_RATE ? 'idle' : 'warning';
    assert.equal(craneHook(scene).phase, expectedPhase, `tick ${tick}`);
  }
  scene.update(NO_INPUT);
  assert.equal(craneHook(scene).phase, 'swinging');
});

test('the hook knocks a player back in the swing direction', () => {
  const scene = harborFight();
  advanceUntil(scene, () => craneHook(scene).phase === 'swinging');
  const red = standInHook(scene, 'red');
  const hitFromX = red.x;
  advance(scene, 10);
  assert.ok(red.x - hitFromX > 15, `red was knocked ${red.x - hitFromX} pixels along the swing`);
});

test('a swing back the other way knocks players the other way', () => {
  const scene = harborFight();
  advanceUntil(scene, () => craneHook(scene).swingIndex === 1 && craneHook(scene).phase === 'swinging');
  assert.equal(craneHook(scene).direction, -1);
  const blue = standInHook(scene, 'blue');
  const hitFromX = blue.x;
  advance(scene, 10);
  assert.ok(hitFromX - blue.x > 15, `blue was knocked ${hitFromX - blue.x} pixels against the first swing`);
});

test('one swing hits a player once', () => {
  const scene = harborFight();
  advanceUntil(scene, () => craneHook(scene).phase === 'swinging');
  const hits = [];
  scene.events.on('trap-sprung', (hit) => hits.push(hit.targetId));
  const red = standInHook(scene, 'red');
  for (let tick = 0; tick < 6; tick++) {
    scene.update(NO_INPUT);
    red.y = craneHook(scene).y;
  }
  assert.deepEqual(hits, ['red']);
});

test('a warning comes before every swing and the hook is harmless during it', () => {
  const scene = harborFight();
  const hitPhases = [];
  scene.events.on('trap-sprung', () => hitPhases.push(craneHook(scene).phase));
  let warningTicks = 0;
  let swingsSeen = 0;
  let previousPhase = 'idle';
  for (let tick = 0; tick < CRANE_FIRST_SWING_TICKS + 3 * CYCLE_TICKS; tick++) {
    if (craneHook(scene).phase === 'warning' && warningTicks < CRANE_WARNING_TICKS / 2) {
      standInHook(scene, 'red');
    } else {
      player(scene, 'red').x = 320;
      player(scene, 'red').y = 100;
    }
    player(scene, 'blue').x = 320;
    player(scene, 'blue').y = 100;
    scene.update(NO_INPUT);
    const hook = craneHook(scene);
    if (hook.phase === 'warning') warningTicks++;
    if (hook.phase === 'swinging' && previousPhase !== 'swinging') {
      swingsSeen++;
      assert.equal(warningTicks, CRANE_WARNING_TICKS, `swing ${swingsSeen} had a full warning first`);
      warningTicks = 0;
    }
    previousPhase = hook.phase;
  }
  assert.equal(swingsSeen, 4);
  assert.deepEqual(hitPhases, [], 'nothing is hit during a warning');
});

test('the swing is the same for the same seed and inputs', () => {
  function hookPositions() {
    const scene = harborFight();
    const positions = [];
    for (let tick = 0; tick < 1000; tick++) {
      scene.update(NO_INPUT);
      positions.push([craneHook(scene).x, craneHook(scene).y]);
    }
    return positions;
  }
  assert.deepEqual(hookPositions(), hookPositions());
});
