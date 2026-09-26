import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PhysicsEntity } from '../src/engine/physics-entity.js';
import { Player } from '../src/entities/player.js';

function makeEntity() {
  return new PhysicsEntity({ x: 100, y: 100, width: 8, height: 12 });
}

test('knockback applied while falling adds to the fall speed instead of setting it', () => {
  const entity = makeEntity();
  entity.applyGravity(0.3, 6);
  const fallSpeedBeforeKnockback = entity.velocityY;

  entity.applyKnockback(0, -5);

  assert.equal(entity.velocityY, fallSpeedBeforeKnockback - 5);
});

test('horizontal knockback decays to zero over time', () => {
  const entity = makeEntity();
  entity.applyKnockback(4, 0);
  assert.ok(entity.knockbackVelocityX > 0);

  for (let tick = 0; tick < 200; tick++) entity.moveAndCollide([]);

  assert.equal(entity.knockbackVelocityX, 0);
});

test('hitting a wall stops horizontal knockback', () => {
  const entity = makeEntity();
  const wall = { x: 108, y: 90, width: 8, height: 40 };
  entity.applyKnockback(4, 0);

  entity.moveAndCollide([wall]);

  assert.equal(entity.knockbackVelocityX, 0);
});

test('a player holding a direction still changes course during knockback', () => {
  const holdLeftPlayer = new Player({ id: 'red', color: '#ff0000', spawnX: 100, spawnY: 100, facing: 1 });
  const idlePlayer = new Player({ id: 'blue', color: '#0000ff', spawnX: 100, spawnY: 100, facing: 1 });
  holdLeftPlayer.applyKnockback(5, 0);
  idlePlayer.applyKnockback(5, 0);

  const holdLeft = { left: true, right: false, jump: false };
  const noInput = { left: false, right: false, jump: false };

  // Both players drift right on the knockback at first; steering only wins out over it after several ticks.
  const TICKS_BEFORE_REVERSAL = 7;
  for (let tick = 0; tick < TICKS_BEFORE_REVERSAL; tick++) {
    holdLeftPlayer.update(holdLeft, []);
    idlePlayer.update(noInput, []);
  }

  const holdLeftXBeforeReversal = holdLeftPlayer.x;
  const idleXBeforeReversal = idlePlayer.x;

  holdLeftPlayer.update(holdLeft, []);
  idlePlayer.update(noInput, []);

  assert.ok(holdLeftPlayer.x < holdLeftXBeforeReversal, 'holding left reverses course: x starts decreasing');
  assert.ok(idlePlayer.x > idleXBeforeReversal, 'holding nothing keeps drifting right with the knockback');
});
