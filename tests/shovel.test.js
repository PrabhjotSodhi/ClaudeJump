import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROUND_COUNTDOWN_TICKS, SHOVE_MAX_CHARGE_TICKS } from '../src/engine/config.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { shovelPose } from '../src/vfx/shovel.js';
import { harborLevel } from './fixtures/harbor-level.mjs';

function input(overrides = {}) {
  return { left: false, right: false, jump: false, action: false, ...overrides };
}

// Red and blue stand at their spawns, too far apart for a shove to land, so nothing freezes the timers.
function soloRed() {
  const scene = new VersusScene({ level: harborLevel, seed: 0 });
  for (let tick = 0; tick < ROUND_COUNTDOWN_TICKS; tick++) scene.update({ red: input(), blue: input() });
  const red = scene.players.find((player) => player.id === 'red');
  const advance = (tickCount, redInput = input()) => {
    const poses = [];
    for (let tick = 0; tick < tickCount; tick++) {
      scene.update({ red: redInput, blue: input() });
      poses.push(shovelPose(red));
    }
    return poses;
  };
  return { red, advance };
}

test('no shovel shows before a shove', () => {
  const { red, advance } = soloRed();
  advance(5);
  assert.equal(shovelPose(red), null);
});

test('a tap shove shows the shovel, sweeps it through and puts it away', () => {
  const { advance } = soloRed();
  const heldPoses = advance(1, input({ action: true }));
  assert.ok(heldPoses[0], 'the shovel shows in the wind-up');
  const frames = advance(20).map((pose) => pose?.frame ?? null);
  assert.ok(frames.indexOf('shovel-forward') > frames.indexOf('shovel-smear'), 'it smears through the hit');
  assert.ok(frames.indexOf('shovel-down') > frames.indexOf('shovel-forward'), 'then follows through low');
  assert.equal(frames.at(-1), null, 'and is put away after');
});

test('a longer charge holds the shovel higher', () => {
  const { advance } = soloRed();
  const poses = advance(SHOVE_MAX_CHARGE_TICKS, input({ action: true }));
  const early = poses[3];
  const full = poses.at(-1);
  assert.ok(full.offsetY < early.offsetY, 'the full charge lifts it higher');
  assert.equal(early.frame, 'shovel-raised');
  assert.equal(full.frame, 'shovel-back', 'and swings it further back');
});

test('the impact shows a puff that grows for a few ticks', () => {
  const { advance } = soloRed();
  advance(1, input({ action: true }));
  const puffAges = advance(12)
    .map((pose) => pose?.puffAge ?? null)
    .filter((age) => age !== null);
  assert.deepEqual(puffAges, [0, 1, 2, 3]);
});
