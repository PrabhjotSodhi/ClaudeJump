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
