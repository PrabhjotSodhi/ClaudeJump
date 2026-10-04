import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ROUND_COUNTDOWN_TICKS, SHOVE_HIT_ZONE_WIDTH, SHOVE_MAX_CHARGE_TICKS } from '../src/engine/config.js';
import { CHARACTERS } from '../src/entities/characters.js';
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

test('a shove that misses shows no impact puff', () => {
  const { advance } = soloRed();
  advance(1, input({ action: true }));
  assert.ok(advance(30).every((pose) => pose === null || pose.puffAge === null));
});

function readSprite(name) {
  return JSON.parse(readFileSync(new URL(`../data/sprites/${name}.json`, import.meta.url), 'utf8'));
}

const shovelFrames = readSprite('props').frames;

function paintedPixels(rows, left, top, mirrored) {
  const pixels = new Set();
  rows.forEach((row, rowIndex) => {
    [...row].forEach((key, column) => {
      if (key === '.') return;
      const x = mirrored ? left - column - 1 : left + column;
      pixels.add(`${x},${top + rowIndex}`);
    });
  });
  return pixels;
}

// Mirrors drawShovel: the grip sits at the middle of the 48 pixel frame, on the hand at the front of the body.
function shovelPixels(player, pose) {
  const grip = 24;
  const handX = player.facing > 0 ? Math.round(player.x) + player.width : Math.round(player.x);
  const originX = handX + player.facing * pose.offsetX;
  const top = Math.round(player.y) + Math.round(player.height / 2) + pose.offsetY - grip;
  const rows = shovelFrames[pose.frame];
  return player.facing > 0
    ? paintedPixels(rows, originX - grip, top, false)
    : paintedPixels(rows, originX + grip, top, true);
}

// Mirrors renderAt for a body standing still: the 32 pixel frame sits bottom centered on the hitbox, one pixel low.
function bodyPixels(player) {
  const left = Math.round(player.x) + player.width / 2 - 16;
  const top = Math.round(player.y) + player.height + 1 - 32;
  return paintedPixels(readSprite(player.character.spriteName).frames.body, left, top, false);
}

// How many columns deep the blade goes into the body.
function overlapDepth(shovel, body) {
  const columns = new Set([...shovel].filter((pixel) => body.has(pixel)).map((pixel) => pixel.split(',')[0]));
  return columns.size;
}

// Red shoves blue, who stands gapPixels in front of red's hitbox, on the side red faces.
function shoveAt({ character, facing, holdTicks, gapPixels }) {
  const scene = new VersusScene({
    level: harborLevel,
    seed: 0,
    players: [
      { id: 'red', character: CHARACTERS[0] },
      { id: 'blue', character },
    ],
  });
  for (let tick = 0; tick < ROUND_COUNTDOWN_TICKS; tick++) scene.update({ red: input(), blue: input() });
  const red = scene.players.find((player) => player.id === 'red');
  const blue = scene.players.find((player) => player.id === 'blue');
  red.x = 300;
  red.facing = facing;
  blue.x = facing > 0 ? red.x + red.width + gapPixels : red.x - gapPixels - blue.width;
  for (const player of [red, blue]) {
    player.y = 116;
    player.onGround = true;
  }
  const frames = [];
  for (let tick = 0; tick < holdTicks + 30; tick++) {
    scene.update({ red: input({ action: tick < holdTicks }), blue: input() });
    const pose = shovelPose(red);
    if (pose && pose.layer !== 'behind')
      frames.push({ pose, depth: overlapDepth(shovelPixels(red, pose), bodyPixels(blue)) });
  }
  return frames;
}

const lastHitGap = SHOVE_HIT_ZONE_WIDTH - 1;
const swings = [
  { name: 'tap', holdTicks: 1 },
  { name: 'full charge', holdTicks: SHOVE_MAX_CHARGE_TICKS + 1 },
];

test('a landed shove pushes the blade at least 2 pixels into every character, from both sides', () => {
  for (const character of CHARACTERS) {
    for (const facing of [1, -1]) {
      for (const { name, holdTicks } of swings) {
        for (const gapPixels of [0, lastHitGap]) {
          const label = `${character.name} ${name} facing ${facing} gap ${gapPixels}`;
          const hitFrames = shoveAt({ character, facing, holdTicks, gapPixels }).filter(
            ({ pose }) => pose.puffAge !== null,
          );
          assert.ok(hitFrames.length > 0, `${label}: the hit shows`);
          for (const { depth } of hitFrames) assert.ok(depth >= 2, `${label}: blade ${depth} pixels in`);
        }
      }
    }
  }
});

test('a shove that misses never touches the character just out of reach', () => {
  for (const character of CHARACTERS) {
    for (const facing of [1, -1]) {
      for (const { name, holdTicks } of swings) {
        const frames = shoveAt({ character, facing, holdTicks, gapPixels: SHOVE_HIT_ZONE_WIDTH });
        const label = `${character.name} ${name} facing ${facing}`;
        assert.ok(frames.length > 0, `${label}: the swing shows`);
        for (const { pose, depth } of frames) {
          assert.equal(pose.puffAge, null, `${label}: no puff`);
          assert.equal(depth, 0, `${label}: ${pose.frame} touches`);
        }
      }
    }
  }
});
