import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PhysicsEntity } from '../src/engine/physics-entity.js';
import { Platform } from '../src/entities/platform.js';
import { PICKUP_USES } from '../src/cards/card-definitions.js';
import { SHOVE_WINDUP_TICKS } from '../src/engine/config.js';
import { Player, SHOVE_ACTIVE_TICKS } from '../src/entities/player.js';
import { findCharacter } from '../src/entities/characters.js';

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
  const holdLeftPlayer = new Player({
    id: 'red',
    character: findCharacter('claude'),
    spawnX: 200,
    spawnY: 200,
    facing: 1,
  });
  const idlePlayer = new Player({
    id: 'blue',
    character: findCharacter('claude'),
    spawnX: 200,
    spawnY: 200,
    facing: 1,
  });
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

test('a player can jump, then jump again in the air, but not a third time', () => {
  const player = new Player({ id: 'red', character: findCharacter('claude'), spawnX: 200, spawnY: 200, facing: 1 });
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
  const player = new Player({ id: 'red', character: findCharacter('claude'), spawnX: 200, spawnY: 200, facing: 1 });
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

// A tap: the press, then the release that fires the shove once the wind-up is done.
function tapShove(player) {
  player.update(actionInput(true), []);
  for (let tick = 0; tick <= SHOVE_WINDUP_TICKS; tick++) player.update(actionInput(false), []);
}

test('a fresh press of the action button starts a shove, but holding it down never fires another one', () => {
  const player = new Player({ id: 'red', character: findCharacter('claude'), spawnX: 200, spawnY: 200, facing: 1 });
  player.onGround = true;
  player.update(actionInput(false), []); // release the action key held from spawn

  tapShove(player);
  assert.ok(player.isShoveActive, 'a fresh press and release starts a shove');
  for (let tick = 0; tick < 50; tick++) player.update(actionInput(false), []);
  player.update(actionInput(true), []);

  let shoveStartedAgainWhileHeld = false;
  for (let tick = 0; tick < 50; tick++) {
    const wasActive = player.isShoveActive;
    player.update(actionInput(true), []); // held the whole time, never released
    if (!wasActive && player.isShoveActive) shoveStartedAgainWhileHeld = true;
  }

  assert.equal(shoveStartedAgainWhileHeld, false, 'holding the button never fires a second shove');
});

test('a press of the action button during the cooldown after a shove does nothing', () => {
  const player = new Player({ id: 'red', character: findCharacter('claude'), spawnX: 200, spawnY: 200, facing: 1 });
  player.onGround = true;
  player.update(actionInput(false), []); // release the action key held from spawn

  tapShove(player);

  for (let tick = 0; tick < SHOVE_ACTIVE_TICKS; tick++) player.update(actionInput(false), []);
  assert.equal(player.isShoveActive, false, 'the shove has ended, but the cooldown has not');

  player.update(actionInput(true), []); // press again while still on cooldown
  assert.equal(player.isShoveActive, false, 'a press during the cooldown does not start another shove');
});

test('a held pickup is played by the action button instead of starting a shove', () => {
  const player = new Player({ id: 'red', character: findCharacter('claude'), spawnX: 200, spawnY: 200, facing: 1 });
  player.onGround = true;
  player.update(actionInput(false), []); // release the action key held from spawn
  player.receiveCard('rocket');

  player.update(actionInput(true), []);

  assert.equal(player.playedCardName, 'rocket', 'the held pickup is played');
  assert.equal(player.isShoveActive, false, 'the button plays the pickup instead of shoving');
});

test('a pickup gives 1 use, and once it is played the button shoves again', () => {
  const player = new Player({ id: 'red', character: findCharacter('claude'), spawnX: 200, spawnY: 200, facing: 1 });
  player.onGround = true;
  player.update(actionInput(false), []); // release the action key held from spawn
  player.receiveCard('rocket');
  assert.equal(PICKUP_USES, 1);

  player.update(actionInput(true), []);
  assert.equal(player.playedCardName, 'rocket');
  assert.equal(player.isShoveActive, false, 'a press with a pickup never shoves');
  assert.equal(player.heldCardName, null, 'the pickup is gone after one use');
  player.update(actionInput(false), []);

  tapShove(player);

  assert.equal(player.isShoveActive, true, 'the button shoves again once the pickup is spent');
});

test('a one way platform lets an entity rise through it and catches it on the way down', () => {
  const entity = makeEntity();
  const platform = new Platform({ x: 180, y: 180, width: 64, height: 16, oneWay: true });
  entity.velocityY = -8;
  for (let tick = 0; tick < 6; tick++) entity.moveAndCollide([platform]);
  assert.ok(entity.y + entity.height < platform.y, 'it rose above the platform');

  for (let tick = 0; tick < 60 && !entity.onGround; tick++) {
    entity.applyGravity(0.6, 12);
    entity.moveAndCollide([platform]);
  }
  assert.equal(entity.y + entity.height, platform.y);
  assert.ok(entity.onGround);
});
