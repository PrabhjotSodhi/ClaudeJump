import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CHARACTERS } from '../src/entities/characters.js';
import { Player } from '../src/entities/player.js';
import {
  CHARACTER_ACTIONS,
  CharacterAnimations,
  pickCharacterAction,
  poseFrame,
} from '../src/vfx/character-animations.js';

const POSES = Object.fromEntries(
  CHARACTER_ACTIONS.map((action) => [
    action,
    JSON.parse(readFileSync(new URL(`../data/images/entities/player/${action}/frames.json`, import.meta.url), 'utf8')),
  ]),
);

function standingPlayer(id = 'red') {
  const player = new Player({ id, character: CHARACTERS[0], spawnX: 100, spawnY: 200, facing: 1 });
  player.onGround = true;
  return player;
}

test('every action has whole pixel frames', () => {
  for (const action of CHARACTER_ACTIONS) {
    const pose = POSES[action];
    const frames = pose.stages ? pose.stages.flat() : pose.frames;
    assert.ok(frames.length > 0, action);
    assert.ok(Number.isInteger(pose.ticksPerFrame) && pose.ticksPerFrame > 0, action);
    for (const frame of frames)
      for (const key of ['x', 'y', 'width', 'height'])
        assert.ok(frame[key] === undefined || Number.isInteger(frame[key]), `${action} ${key}`);
  }
});

test('the action follows what the player is doing', () => {
  const player = standingPlayer();
  assert.equal(pickCharacterAction(player), 'idle');

  player.velocityX = 3;
  assert.equal(pickCharacterAction(player), 'run');

  player.onGround = false;
  player.velocityY = -5;
  assert.equal(pickCharacterAction(player), 'jump');
  player.velocityY = 4;
  assert.equal(pickCharacterAction(player), 'fall');

  player.shoveCharging = true;
  player.shoveChargeTicks = 1;
  assert.equal(pickCharacterAction(player), 'windup');
  player.shoveChargeTicks = 10;
  assert.equal(pickCharacterAction(player), 'charge');
  player.shoveCharging = false;

  player.freeze('heavy', 6, -4);
  assert.equal(pickCharacterAction(player), 'hurt');
  for (let tick = 0; tick < 10 && player.isFrozen; tick++) player.update(null, []);
  assert.equal(pickCharacterAction(player), 'launched');
});

test('a charge shakes harder the longer it is held', () => {
  const shakeAt = (chargeProgress) => {
    const offsets = [0, 1, 2, 3].map((tick) => poseFrame(POSES.charge, tick * 2, chargeProgress).x);
    return Math.max(...offsets) - Math.min(...offsets);
  };

  assert.ok(shakeAt(0) < shakeAt(0.5));
  assert.ok(shakeAt(0.5) < shakeAt(1));
});

test('eyes blink now and then, briefly, at uneven intervals', () => {
  const player = standingPlayer();
  const animations = new CharacterAnimations(POSES);
  animations.attach(() => [player]);
  const blinkStarts = [];
  let closedTicks = 0;
  let wasClosed = false;
  for (let tick = 0; tick < 1200; tick++) {
    animations.update();
    const closed = animations.poseFor(player).eyes === 'closed';
    if (closed && !wasClosed) blinkStarts.push(tick);
    if (closed) closedTicks++;
    wasClosed = closed;
  }

  assert.ok(blinkStarts.length >= 4, `blinked ${blinkStarts.length} times`);
  assert.ok(closedTicks < 1200 / 10, 'eyes are open most of the time');
  const gaps = blinkStarts.slice(1).map((start, index) => start - blinkStarts[index]);
  assert.ok(new Set(gaps).size > 1, 'blinks do not keep a steady beat');
});

test('running kicks up dust at the feet and standing still does not', () => {
  const player = standingPlayer();
  const animations = new CharacterAnimations(POSES);
  animations.attach(() => [player]);
  for (let tick = 0; tick < 30; tick++) animations.update();
  assert.equal(animations.dustPuffs.length, 0);

  player.velocityX = 3;
  for (let tick = 0; tick < 4; tick++) animations.update();
  assert.ok(animations.dustPuffs.length > 0);
  assert.ok(
    animations.dustPuffs.every((puff) => puff.x < player.x + player.width / 2),
    'dust trails behind',
  );
});

test('a full charge lands in the last shake stage', () => {
  const lastStage = POSES.charge.stages.at(-1);
  assert.ok(lastStage.includes(poseFrame(POSES.charge, 0, 1)));
});
