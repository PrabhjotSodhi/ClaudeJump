import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Player } from '../src/entities/player.js';

const wideGround = [{ x: -5000, y: 200, width: 10000, height: 16 }];

function idleInput() {
  return { left: false, right: false, jump: false, action: false };
}

function groundedPlayer() {
  const player = new Player({ id: 'red', color: '#f00', spawnX: 0, spawnY: 200, facing: 1 });
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

function recordedBodyRects(player) {
  const rects = [];
  const context = {
    fillRect(x, y, width, height) {
      rects.push({ x, y, width, height, color: this.fillStyle });
    },
  };
  player.render(context);
  return rects.find((rect) => rect.color === player.color);
}

test('landing squashes the drawn player wider and shorter for a few ticks, feet fixed, hitbox unchanged', () => {
  const player = new Player({ id: 'red', color: '#f00', spawnX: 0, spawnY: 150, facing: 1 });
  let landed = false;
  for (let tick = 0; tick < 60 && !landed; tick++) {
    player.update(idleInput(), wideGround);
    landed = player.onGround;
  }
  assert.ok(landed);

  const hitbox = { x: player.x, y: player.y, width: player.width, height: player.height };
  const body = recordedBodyRects(player);
  assert.equal(body.width, 28, '4 px wider');
  assert.equal(body.y + body.height, Math.round(player.y) + player.height, 'the feet stay where they were');
  assert.equal(body.x + body.width / 2, Math.round(player.x) + player.width / 2, 'still centered');
  assert.deepEqual({ x: player.x, y: player.y, width: player.width, height: player.height }, hitbox);

  for (let tick = 0; tick < 6; tick++) player.update(idleInput(), wideGround);
  assert.equal(recordedBodyRects(player).width, 24, 'back to normal after 6 ticks');
});

test('jumping stretches the drawn player thinner and taller, hitbox unchanged', () => {
  const player = groundedPlayer();
  for (let tick = 0; tick < 6; tick++) player.update(idleInput(), wideGround);
  const hitbox = { width: player.width, height: player.height };

  player.update({ ...idleInput(), jump: true }, wideGround);
  const body = recordedBodyRects(player);
  assert.equal(body.width, 20, '4 px thinner');
  assert.equal(body.y + body.height, Math.round(player.y) + player.height, 'the feet stay where they were');
  assert.equal(body.height, hitbox.height - 14 + 4, '4 px taller');
  assert.deepEqual({ width: player.width, height: player.height }, hitbox);
});
