import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Player } from '../src/entities/player.js';
import { SCREEN_WIDTH } from '../src/engine/config.js';
import { findCharacter } from '../src/entities/characters.js';
import { PlayerEyes } from '../src/vfx/player-eyes.js';
import { recordingContext, spritesFor } from './fixtures/recording-context.mjs';

const wideGround = [{ x: -5000, y: 200, width: 10000, height: 16 }];

function idleInput() {
  return { left: false, right: false, jump: false, action: false };
}

function groundedPlayer() {
  const player = new Player({ id: 'red', character: findCharacter('claude'), spawnX: 0, spawnY: 200, facing: 1 });
  for (let tick = 0; tick < 5; tick++) player.update(idleInput(), wideGround);
  return player;
}

test('a slipping player slides the way they were moving for the set ticks, barely steerable', () => {
  const player = groundedPlayer();
  player.velocityX = -3;
  player.makeSlip(45);
  const startX = player.x;

  for (let tick = 0; tick < 45; tick++) player.update({ ...idleInput(), right: true, jump: true }, wideGround);

  assert.ok(player.x < startX - 45 * 4, 'slides left at speed even with right held');
  assert.equal(player.slipTicksRemaining, 0);
  assert.equal(player.onGround, true, 'jump is ignored while slipping');

  for (let tick = 0; tick < 30; tick++) player.update({ ...idleInput(), right: true }, wideGround);
  assert.ok(player.velocityX > 0, 'steering works again once the slip is over');
});

function drawnBodies(player) {
  const context = recordingContext();
  player.render(context, { sprites: spritesFor('claude'), playerEyes: new PlayerEyes() });
  return context.bodyDraws;
}

function drawnBody(player) {
  const [body] = drawnBodies(player);
  return body;
}

test('a player is drawn as its 32x32 sprite, bottom centered on the hitbox and one pixel into the platform', () => {
  const player = groundedPlayer();
  for (let tick = 0; tick < 6; tick++) player.update(idleInput(), wideGround);

  const body = drawnBody(player);

  assert.equal(body.width, 32);
  assert.equal(body.height, 32);
  assert.equal(body.x + body.width / 2, Math.round(player.x) + player.width / 2, 'centered on the hitbox');
  assert.equal(body.y + body.height, Math.round(player.y) + player.height + 1, 'overlaps the platform by one row');
});

test('landing squashes the drawn player wider and shorter for a few ticks, feet fixed, hitbox unchanged', () => {
  const player = new Player({ id: 'red', character: findCharacter('claude'), spawnX: 0, spawnY: 150, facing: 1 });
  let landed = false;
  for (let tick = 0; tick < 60 && !landed; tick++) {
    player.update(idleInput(), wideGround);
    landed = player.onGround;
  }
  assert.ok(landed);

  const hitbox = { x: player.x, y: player.y, width: player.width, height: player.height };
  const body = drawnBody(player);
  assert.equal(body.width, 36, '4 px wider');
  assert.equal(body.height, 28, '4 px shorter');
  assert.equal(body.y + body.height, Math.round(player.y) + player.height + 1, 'the feet stay where they were');
  assert.equal(body.x + body.width / 2, Math.round(player.x) + player.width / 2, 'still centered');
  assert.deepEqual({ x: player.x, y: player.y, width: player.width, height: player.height }, hitbox);

  for (let tick = 0; tick < 6; tick++) player.update(idleInput(), wideGround);
  assert.equal(drawnBody(player).width, 32, 'back to normal after 6 ticks');
});

test('jumping stretches the drawn player thinner and taller, hitbox unchanged', () => {
  const player = groundedPlayer();
  for (let tick = 0; tick < 6; tick++) player.update(idleInput(), wideGround);
  const hitbox = { width: player.width, height: player.height };

  player.update({ ...idleInput(), jump: true }, wideGround);
  const body = drawnBody(player);
  assert.equal(body.width, 28, '4 px thinner');
  assert.equal(body.height, 36, '4 px taller');
  assert.equal(body.y + body.height, Math.round(player.y) + player.height + 1, 'the feet stay where they were');
  assert.deepEqual({ width: player.width, height: player.height }, hitbox);
});

test('a player crossing the screen edge is drawn a second time a screen width away', () => {
  const player = groundedPlayer();
  player.x = -10;

  const [body, wrappedBody] = drawnBodies(player);

  assert.equal(drawnBodies(player).length, 2);
  assert.equal(wrappedBody.x, body.x + SCREEN_WIDTH);
  assert.equal(wrappedBody.y, body.y);
});

test('a player takes its color from its character', () => {
  const player = new Player({ id: 'blue', character: findCharacter('gemini'), spawnX: 0, spawnY: 150, facing: 1 });

  assert.equal(player.color, '#0099db');
  assert.equal(player.character.displayName, 'Gemini');
  assert.equal(player.id, 'blue');
});
