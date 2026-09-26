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

test('a dizzy player ignores input for exactly 20 ticks', () => {
  const player = new Player({ id: 'blue', color: '#0000ff', spawnX: 100, spawnY: 100, facing: 1 });
  player.onGround = true;
  player.update({ left: false, right: false, jump: false }, []); // release the jump key held from spawn

  const DIZZY_TICKS = 20;
  player.makeDizzy(DIZZY_TICKS);

  const rightAndJump = { left: false, right: true, jump: true };
  for (let tick = 0; tick < DIZZY_TICKS; tick++) {
    player.update(rightAndJump, []);
    assert.equal(player.velocityX, 0, `steering should be ignored on dizzy tick ${tick}`);
    assert.ok(player.velocityY >= 0, `jumping should be ignored on dizzy tick ${tick}`);
  }

  player.update(rightAndJump, []);
  assert.ok(player.velocityX > 0, 'steering works again once dizziness ends');
});

test('a player can jump, then jump again in the air, but not a third time', () => {
  const player = new Player({ id: 'red', color: '#ff0000', spawnX: 100, spawnY: 100, facing: 1 });
  player.onGround = true;
  player.update({ left: false, right: false, jump: false }, []); // release the jump key held from spawn

  // A fresh jump snaps velocityY sharply upward; falling residue from an earlier jump's release never does.
  function pressJumpWhileFalling() {
    while (player.velocityY <= 0.5) player.update({ left: false, right: false, jump: false }, []);
    player.update({ left: false, right: false, jump: true }, []);
    const jumped = player.velocityY < -3;
    player.update({ left: false, right: false, jump: false }, []);
    return jumped;
  }

  assert.equal(pressJumpWhileFalling(), true, 'the ground jump should launch the player upward');
  assert.equal(pressJumpWhileFalling(), true, 'the air jump should launch the player upward again');
  assert.equal(pressJumpWhileFalling(), false, 'a third jump in the air should do nothing');
});

test('landing refreshes the air jump', () => {
  const player = new Player({ id: 'red', color: '#ff0000', spawnX: 100, spawnY: 100, facing: 1 });
  player.onGround = true;
  player.update({ left: false, right: false, jump: false }, []); // release the jump key held from spawn

  player.update({ left: false, right: false, jump: true }, []); // ground jump
  player.update({ left: false, right: false, jump: false }, []);
  player.update({ left: false, right: false, jump: true }, []); // air jump, consumes it
  assert.equal(player.airJumpAvailable, false);

  player.onGround = true; // simulate landing
  player.update({ left: false, right: false, jump: false }, []);

  assert.equal(player.airJumpAvailable, true);
});
