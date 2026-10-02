import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HITSTOP_TICKS, SHOVE_MAX_CHARGE_TICKS, SHOVE_WINDUP_TICKS } from '../src/engine/config.js';
import { SHOVE_KNOCKBACK_VELOCITY_X, SHOVE_KNOCKBACK_VELOCITY_Y } from '../src/entities/player.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { harborLevel } from './fixtures/harbor-level.mjs';
import { ROUND_COUNTDOWN_TICKS as READY_TICKS } from '../src/engine/config.js';

function input(overrides = {}) {
  return { left: false, right: false, jump: false, action: false, ...overrides };
}

function advance(scene, tickCount, redInput = input()) {
  for (let tick = 0; tick < tickCount; tick++) scene.update({ red: redInput, blue: input() });
}

function player(scene, id) {
  return scene.players.find((candidate) => candidate.id === id);
}

// Red faces blue with blue inside the shove zone, and the action key released.
function shoveSetup() {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  const red = player(scene, 'red');
  const blue = player(scene, 'blue');
  red.x = 264;
  red.y = 116;
  red.onGround = true;
  red.facing = 1;
  blue.x = 300;
  blue.y = 116;
  blue.onGround = true;
  advance(scene, 1);
  return { scene, red, blue };
}

// Holds the button for holdTicks ticks including the press, releases, and returns what blue was launched with.
function shoveHeldFor(holdTicks) {
  const { scene, red, blue } = shoveSetup();
  const events = [];
  scene.events.on('player-shoved', (event) => events.push(event));
  advance(scene, holdTicks, input({ action: true }));
  let ticksSinceRelease = 0;
  while (events.length === 0 && ticksSinceRelease < 20) {
    advance(scene, 1);
    ticksSinceRelease++;
  }
  assert.equal(events.length, 1, 'the shove landed');
  let frozenTicks = 0;
  while (blue.isFrozen) {
    advance(scene, 1);
    frozenTicks++;
  }
  return {
    red,
    blue,
    event: events[0],
    frozenTicks,
    launchX: blue.knockbackVelocityX,
    launchY: blue.velocityY,
    ticksSinceRelease,
  };
}

test('a tap hits within 6 ticks of the press and knocks back with the base value', () => {
  const { event, launchX, ticksSinceRelease } = shoveHeldFor(1);

  assert.ok(1 + ticksSinceRelease < 6, 'press to hit stays under 6 ticks');
  assert.equal(event.charge, 0);
  assert.equal(event.strength, 'light');
  assert.equal(launchX, SHOVE_KNOCKBACK_VELOCITY_X);
});

test('a tap winds up for a few ticks before the shove is active', () => {
  const { scene, red } = shoveSetup();

  advance(scene, 1, input({ action: true }));
  advance(scene, 1);
  assert.equal(red.shoveCharging, true, 'the wind-up pose is showing');
  assert.equal(red.isShoveActive, false, 'the shove has not started yet');

  advance(scene, SHOVE_WINDUP_TICKS);
  assert.equal(red.shoveCharging, false);
  assert.equal(red.isShoveActive, true);
});

test('a full charge knocks back 1.6 times as far, with a stronger freeze', () => {
  const tap = shoveHeldFor(1);
  const full = shoveHeldFor(SHOVE_MAX_CHARGE_TICKS + 1);

  assert.equal(full.event.charge, 1);
  assert.equal(full.event.strength, 'medium');
  assert.equal(full.frozenTicks, HITSTOP_TICKS.medium);
  assert.equal(full.launchX, tap.launchX * 1.6);
  assert.equal(full.launchY, tap.launchY + SHOVE_KNOCKBACK_VELOCITY_Y * 0.6);
});

test('a half charge knocks back between a tap and a full charge', () => {
  const tap = shoveHeldFor(1);
  const half = shoveHeldFor(SHOVE_MAX_CHARGE_TICKS / 2);
  const full = shoveHeldFor(SHOVE_MAX_CHARGE_TICKS + 1);

  assert.ok(half.launchX > tap.launchX);
  assert.ok(half.launchX < full.launchX);
  assert.equal(half.event.strength, 'light');
});

test('holding past full charge adds nothing', () => {
  const full = shoveHeldFor(SHOVE_MAX_CHARGE_TICKS + 1);
  const overheld = shoveHeldFor(SHOVE_MAX_CHARGE_TICKS * 3);

  assert.equal(overheld.launchX, full.launchX);
  assert.equal(overheld.event.charge, 1);
});

test('reaching full charge emits an event once', () => {
  const { scene } = shoveSetup();
  const chargedIds = [];
  scene.events.on('shove-fully-charged', ({ playerId }) => chargedIds.push(playerId));

  advance(scene, SHOVE_MAX_CHARGE_TICKS - 1, input({ action: true }));
  assert.deepEqual(chargedIds, []);
  advance(scene, 1, input({ action: true }));
  advance(scene, 20, input({ action: true }));

  assert.deepEqual(chargedIds, ['red']);
});

test('a charging player walks slower than a player who is not charging', () => {
  function topSpeed(action) {
    const { scene, red } = shoveSetup();
    red.x = 100;
    red.facing = 1;
    let fastest = 0;
    for (let tick = 0; tick < 30; tick++) {
      advance(scene, 1, input({ right: true, action }));
      fastest = Math.max(fastest, red.velocityX);
    }
    return fastest;
  }

  const walking = topSpeed(false);
  const charging = topSpeed(true);

  assert.ok(charging > 0, 'a charging player still moves');
  assert.ok(charging <= walking * 0.3, 'charging is much slower');
});

test('a charging player cannot jump, and can again once the shove fires', () => {
  const { scene, red } = shoveSetup();
  const startY = red.y;
  advance(scene, 1, input({ action: true }));
  advance(scene, 1, input({ action: true, jump: true }));
  advance(scene, 10, input({ action: true, jump: true }));
  assert.equal(red.y, startY, 'a jump pressed while charging does nothing');
  assert.ok(red.onGround);

  advance(scene, HITSTOP_TICKS.heavy + 2, input());
  advance(scene, 3, input({ jump: true }));
  assert.ok(red.y < startY, 'after the release a jump works');
});

test('a held card is played on the press and the shove never charges', () => {
  const { scene, red } = shoveSetup();
  red.receiveCard('rocket');
  const playedCards = [];
  scene.events.on('card-played', ({ cardName }) => playedCards.push(cardName));

  advance(scene, 1, input({ action: true }));
  assert.deepEqual(playedCards, ['rocket'], 'the card plays on the press');
  assert.equal(red.shoveCharging, false);

  advance(scene, SHOVE_MAX_CHARGE_TICKS, input({ action: true }));
  advance(scene, SHOVE_WINDUP_TICKS + 1);
  assert.equal(red.isShoveActive, false, 'the held button and its release never shove');
});

test('being hit cancels a charge', () => {
  const { scene, red } = shoveSetup();
  advance(scene, 10, input({ action: true }));
  assert.equal(red.shoveCharging, true);

  red.freeze('light');
  advance(scene, 1, input({ action: true }));

  assert.equal(red.shoveCharging, false);
  advance(scene, HITSTOP_TICKS.light + SHOVE_WINDUP_TICKS + 2);
  assert.equal(red.isShoveActive, false, 'the cancelled charge never fires');
});

test('a charging shove reports a rising charge until it is full', () => {
  const { scene } = shoveSetup();
  const charges = [];
  scene.events.on('shove-charging', ({ playerId, charge }) => charges.push({ playerId, charge }));

  advance(scene, SHOVE_MAX_CHARGE_TICKS * 2, input({ action: true }));

  assert.ok(charges.length >= 3);
  assert.ok(charges.every(({ playerId }) => playerId === 'red'));
  assert.ok(
    charges.every(
      ({ charge }, index) => charge > 0 && charge < 1 && (index === 0 || charge > charges[index - 1].charge),
    ),
  );
});
