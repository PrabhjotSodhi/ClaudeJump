import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PhysicsEntity } from '../src/engine/physics-entity.js';

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

test('a player holding a direction still changes course during knockback', async () => {
  const { Player } = await import('../src/entities/player.js');

  const knockedPlayer = new Player({ id: 'red', color: '#ff0000', spawnX: 100, spawnY: 100, facing: 1 });
  knockedPlayer.applyKnockback(5, 0); // knocked hard to the right

  const idlePlayer = new Player({ id: 'blue', color: '#0000ff', spawnX: 100, spawnY: 100, facing: 1 });

  const holdLeft = { left: true, right: false, jump: false };
  const noInput = { left: false, right: false, jump: false };

  knockedPlayer.update(holdLeft, []);
  for (let tick = 0; tick < 60; tick++) idlePlayer.update(noInput, []);

  assert.ok(
    knockedPlayer.velocityX < 0,
    'holding left steers velocity left on the very next tick despite the knockback',
  );
  assert.equal(idlePlayer.velocityX, 0, 'a player holding nothing never moves left');
});
