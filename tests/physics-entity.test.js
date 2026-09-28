import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PhysicsEntity } from '../src/engine/physics-entity.js';
import { PICKUP_USES } from '../src/cards/card-definitions.js';
import { Player, SHOVE_ACTIVE_TICKS } from '../src/entities/player.js';

function makeEntity() {
  return new PhysicsEntity({ x: 200, y: 200, width: 16, height: 24 });
}

test('knockback applied while falling adds to the fall speed instead of setting it', () => {
  const entity = makeEntity();
  entity.applyGravity(0.3, 6);
  const fallSpeedBeforeKnockback = entity.velocityY;

  entity.applyKnockback(0, -10);

  assert.equal(entity.velocityY, fallSpeedBeforeKnockback - 10);
});

test('horizontal knockback decays to zero over time', () => {
  const entity = makeEntity();
  entity.applyKnockback(8, 0);
  assert.ok(entity.knockbackVelocityX > 0);

  for (let tick = 0; tick < 200; tick++) entity.moveAndCollide([]);

  assert.equal(entity.knockbackVelocityX, 0);
});

function knockbackDistance(onGround, knockbackVelocityX) {
  const entity = makeEntity();
  entity.onGround = onGround;
  entity.applyKnockback(knockbackVelocityX, 0);
  const startX = entity.x;

  for (let tick = 0; tick < 200; tick++) {
    entity.onGround = onGround; // moveAndCollide clears onGround each tick when there are no platforms to land on
    entity.moveAndCollide([]);
  }

  return entity.x - startX;
}

test('air knockback carries farther than the same ground knockback', () => {
  const groundDistance = knockbackDistance(true, 12);
  const airDistance = knockbackDistance(false, 12);
  assert.ok(airDistance > groundDistance);
  assert.ok(groundDistance < 80, `expected under 80px on the ground, got ${groundDistance}px`);
});

test('a horizontal knockback of 12 in the air carries the player between 120 and 180 px', () => {
  const distance = knockbackDistance(false, 12);
  assert.ok(distance >= 120 && distance <= 180, `expected 120-180px, got ${distance}px`);
});

test('hitting a wall stops horizontal knockback', () => {
  const entity = makeEntity();
  const wall = { x: 216, y: 180, width: 16, height: 80 };
  entity.applyKnockback(8, 0);

  entity.moveAndCollide([wall]);

  assert.equal(entity.knockbackVelocityX, 0);
});

test('a player holding a direction still changes course during knockback', () => {
  const holdLeftPlayer = new Player({ id: 'red', color: '#ff0000', spawnX: 200, spawnY: 200, facing: 1 });
  const idlePlayer = new Player({ id: 'blue', color: '#0000ff', spawnX: 200, spawnY: 200, facing: 1 });
  holdLeftPlayer.applyKnockback(10, 0);
  idlePlayer.applyKnockback(10, 0);

  const holdLeft = { left: true, right: false, jump: false };
  const noInput = { left: false, right: false, jump: false };

  // Both players drift right on the knockback at first; steering only wins out over it after several ticks.
  // Air knockback decays slowly, so this takes longer than it would on the ground.
  const TICKS_BEFORE_REVERSAL = 13;
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
  const player = new Player({ id: 'blue', color: '#0000ff', spawnX: 200, spawnY: 200, facing: 1 });
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
  const player = new Player({ id: 'red', color: '#ff0000', spawnX: 200, spawnY: 200, facing: 1 });
  player.onGround = true;
  player.update({ left: false, right: false, jump: false }, []); // release the jump key held from spawn

  // A fresh jump snaps velocityY sharply upward; falling residue from an earlier jump's release never does.
  function pressJumpWhileFalling() {
    while (player.velocityY <= 1) player.update({ left: false, right: false, jump: false }, []);
    player.update({ left: false, right: false, jump: true }, []);
    const jumped = player.velocityY < -6;
    player.update({ left: false, right: false, jump: false }, []);
    return jumped;
  }

  assert.equal(pressJumpWhileFalling(), true, 'the ground jump should launch the player upward');
  assert.equal(pressJumpWhileFalling(), true, 'the air jump should launch the player upward again');
  assert.equal(pressJumpWhileFalling(), false, 'a third jump in the air should do nothing');
});

test('landing refreshes the air jump', () => {
  const player = new Player({ id: 'red', color: '#ff0000', spawnX: 200, spawnY: 200, facing: 1 });
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

function actionInput(action) {
  return { left: false, right: false, jump: false, action };
}

test('a fresh press of the action button starts a shove, but holding it down never fires another one', () => {
  const player = new Player({ id: 'red', color: '#ff0000', spawnX: 200, spawnY: 200, facing: 1 });
  player.onGround = true;
  player.update(actionInput(false), []); // release the action key held from spawn

  player.update(actionInput(true), []); // fresh press
  assert.ok(player.isShoveActive, 'the fresh press starts a shove');

  let shoveStartedAgainWhileHeld = false;
  for (let tick = 0; tick < 50; tick++) {
    const wasActive = player.isShoveActive;
    player.update(actionInput(true), []); // held the whole time, never released
    if (!wasActive && player.isShoveActive) shoveStartedAgainWhileHeld = true;
  }

  assert.equal(shoveStartedAgainWhileHeld, false, 'holding the button never fires a second shove');
});

test('a press of the action button during the cooldown after a shove does nothing', () => {
  const player = new Player({ id: 'red', color: '#ff0000', spawnX: 200, spawnY: 200, facing: 1 });
  player.onGround = true;
  player.update(actionInput(false), []); // release the action key held from spawn

  player.update(actionInput(true), []); // fresh press starts a shove
  player.update(actionInput(false), []); // release

  for (let tick = 0; tick < SHOVE_ACTIVE_TICKS; tick++) player.update(actionInput(false), []);
  assert.equal(player.isShoveActive, false, 'the shove has ended, but the cooldown has not');

  player.update(actionInput(true), []); // press again while still on cooldown
  assert.equal(player.isShoveActive, false, 'a press during the cooldown does not start another shove');
});

test('a dizzy player cannot shove', () => {
  const player = new Player({ id: 'red', color: '#ff0000', spawnX: 200, spawnY: 200, facing: 1 });
  player.onGround = true;
  player.update(actionInput(false), []); // release the action key held from spawn
  player.makeDizzy(20);

  player.update(actionInput(true), []);

  assert.equal(player.isShoveActive, false, 'a dizzy player cannot start a shove');
});

test('a held pickup is played by the action button instead of starting a shove', () => {
  const player = new Player({ id: 'red', color: '#ff0000', spawnX: 200, spawnY: 200, facing: 1 });
  player.onGround = true;
  player.update(actionInput(false), []); // release the action key held from spawn
  player.receiveCard('rocket');

  player.update(actionInput(true), []);

  assert.equal(player.playedCardName, 'rocket', 'the held pickup is played');
  assert.equal(player.isShoveActive, false, 'the button plays the pickup instead of shoving');
});

test('a pickup gives 3 uses, each press spends one, and at 0 the button shoves again', () => {
  const player = new Player({ id: 'red', color: '#ff0000', spawnX: 200, spawnY: 200, facing: 1 });
  player.onGround = true;
  player.update(actionInput(false), []); // release the action key held from spawn
  player.receiveCard('rocket');
  assert.equal(PICKUP_USES, 3);
  assert.equal(player.heldCardUsesRemaining, 3, 'a fresh pickup has 3 uses');

  for (const usesLeft of [2, 1, 0]) {
    player.update(actionInput(true), []);
    assert.equal(player.playedCardName, 'rocket');
    assert.equal(player.heldCardUsesRemaining, usesLeft);
    assert.equal(player.isShoveActive, false, 'a press with a pickup never shoves');
    player.update(actionInput(false), []);
  }
  assert.equal(player.heldCardName, null, 'the pickup is gone at 0 uses');

  player.update(actionInput(true), []);

  assert.equal(player.playedCardName, null);
  assert.equal(player.isShoveActive, true, 'the button shoves again once the pickup is spent');
});
