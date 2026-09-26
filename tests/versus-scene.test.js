import assert from 'node:assert/strict';
import { test } from 'node:test';
import { VersusScene } from '../src/scenes/versus-scene.js';

function noInput() {
  return { left: false, right: false, jump: false };
}

function neutralInputs() {
  return { red: noInput(), blue: noInput() };
}

function advance(scene, tickCount, inputs = neutralInputs()) {
  for (let tick = 0; tick < tickCount; tick++) scene.update(inputs);
}

function findPlayer(scene, id) {
  return scene.players.find((player) => player.id === id);
}

const READY_TICKS = 60;

test('falling in the sea scores the other player', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);
  assert.equal(scene.phase, 'fight');

  const waterEvents = [];
  scene.events.on('player-fell-in-water', (event) => waterEvents.push(event));

  findPlayer(scene, 'red').y = 300;
  scene.update(neutralInputs());

  assert.deepEqual(waterEvents, [{ playerId: 'red' }]);
  assert.equal(scene.phase, 'point');
  assert.equal(scene.winnerId, 'blue');
  assert.equal(scene.wins.blue, 1);
  assert.equal(scene.wins.red, 0);
});

test('reaching 5 points ends the match', () => {
  const scene = new VersusScene();

  for (let win = 1; win <= 5; win++) {
    advance(scene, READY_TICKS);
    findPlayer(scene, 'blue').y = 300;
    scene.update(neutralInputs());

    assert.equal(scene.wins.red, win);
    if (win < 5) {
      assert.equal(scene.phase, 'point');
      advance(scene, 90); // point pause resolves back to a fresh 'ready' round
    }
  }

  assert.equal(scene.phase, 'match');
});

test('both players falling on the same tick is a draw', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  findPlayer(scene, 'red').y = 300;
  findPlayer(scene, 'blue').y = 300;
  scene.update(neutralInputs());

  assert.equal(scene.phase, 'point');
  assert.equal(scene.winnerId, null);
  assert.equal(scene.wins.red, 0);
  assert.equal(scene.wins.blue, 0);
});

test('running the same input records twice produces identical game state', () => {
  const inputRecords = [];
  for (let tick = 0; tick < 250; tick++) {
    inputRecords.push({
      red: { left: false, right: tick % 3 !== 0, jump: tick % 47 === 0 },
      blue: { left: tick % 5 === 0, right: false, jump: tick % 61 === 0 },
    });
  }

  function runToSnapshot() {
    const scene = new VersusScene();
    for (const input of inputRecords) scene.update(input);
    return {
      phase: scene.phase,
      winnerId: scene.winnerId,
      wins: { ...scene.wins },
      players: scene.players.map((player) => ({
        x: player.x,
        y: player.y,
        velocityX: player.velocityX,
        velocityY: player.velocityY,
        onGround: player.onGround,
        inWater: player.inWater,
      })),
    };
  }

  assert.deepEqual(runToSnapshot(), runToSnapshot());
});

test('two players running into each other end up side by side, never overlapping', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  red.x = 132;
  red.y = 60;
  red.onGround = true;
  blue.x = 178;
  blue.y = 60;
  blue.onGround = true;

  for (let tick = 0; tick < 60; tick++) {
    scene.update({ red: { left: false, right: true, jump: false }, blue: { left: true, right: false, jump: false } });
  }

  assert.equal(red.overlaps(blue), false);
  assert.ok(red.x < blue.x, 'red stays on the left, blue stays on the right');
});

test('a player running into a standing player pushes them', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  red.x = 132;
  red.y = 60;
  red.onGround = true;
  blue.x = 170;
  blue.y = 60;
  blue.onGround = true;
  const blueStartX = blue.x;

  for (let tick = 0; tick < 40; tick++) {
    scene.update({ red: { left: false, right: true, jump: false }, blue: noInput() });
  }

  assert.ok(blue.x > blueStartX, 'the standing player gets shoved away');
  assert.equal(red.overlaps(blue), false);
});

test('a player jumping over another is not pushed sideways', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  red.x = 132;
  red.y = 60;
  red.onGround = true;
  blue.x = 150;
  blue.y = 60;
  blue.onGround = true;
  const blueStartX = blue.x;

  const bumpEvents = [];
  scene.events.on('players-bumped', (event) => bumpEvents.push(event));

  scene.update({ red: noInput(), blue: noInput() }); // releases the jump key held from spawn before pressing it fresh

  for (let tick = 0; tick < 35; tick++) {
    scene.update({ red: { left: false, right: true, jump: tick < 15 }, blue: noInput() });
  }

  assert.equal(blue.x, blueStartX, 'jumping over does not shove the other player');
  assert.deepEqual(bumpEvents, []);
});

test('players-bumped fires once per contact, not every tick', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  red.x = 132;
  red.y = 60;
  red.onGround = true;
  blue.x = 178;
  blue.y = 60;
  blue.onGround = true;

  const bumpEvents = [];
  scene.events.on('players-bumped', (event) => bumpEvents.push(event));

  for (let tick = 0; tick < 60; tick++) {
    scene.update({ red: { left: false, right: true, jump: false }, blue: { left: true, right: false, jump: false } });
  }

  assert.equal(bumpEvents.length, 1);
  assert.deepEqual(bumpEvents[0], { playerIds: ['red', 'blue'] });
});

test('two players held into each other settle at a gap of zero, not a buzz', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  red.x = 132;
  red.y = 60;
  red.onGround = true;
  blue.x = 178;
  blue.y = 60;
  blue.onGround = true;

  const inputs = { red: { left: false, right: true, jump: false }, blue: { left: true, right: false, jump: false } };
  let contactStarted = false;
  for (let tick = 0; tick < 120; tick++) {
    scene.update(inputs);
    const gap = blue.x - (red.x + red.width);
    if (!contactStarted) {
      if (gap === 0) contactStarted = true;
      continue;
    }
    assert.equal(gap, 0, `gap should stay at 0 once contact starts, tick ${tick}`);
  }

  assert.ok(contactStarted, 'the players should have made contact');
});

test('a stomp bounces the stomper up and knocks the other player sideways, away from the stomper', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  blue.x = 150;
  blue.y = 60;
  blue.onGround = true;
  red.x = 146; // left of blue's center, so a stomp should knock blue further right
  red.y = 45;
  red.velocityY = 2;
  red.onGround = false;

  const stompEvents = [];
  scene.events.on('player-stomped', (event) => stompEvents.push(event));

  for (let tick = 0; tick < 5; tick++) {
    scene.update({ red: { left: false, right: false, jump: true }, blue: noInput() });
  }

  assert.deepEqual(stompEvents, [{ stomperId: 'red', stompedId: 'blue' }]);
  assert.ok(red.velocityY < 0, 'the stomper bounces upward');
  assert.ok(blue.knockbackVelocityX > 0, 'the stomped player is knocked away from the stomper');
  assert.ok(blue.dizzyTicksRemaining > 0, 'the stomped player is dizzy');
});

test('holding jump during a stomp bounces higher than not holding it', () => {
  function stompAndBounce(jumpHeldDuringStomp) {
    const scene = new VersusScene();
    advance(scene, READY_TICKS);

    const red = findPlayer(scene, 'red');
    const blue = findPlayer(scene, 'blue');
    blue.x = 150;
    blue.y = 60;
    blue.onGround = true;
    red.x = 150;
    red.y = 45;
    red.velocityY = 2;
    red.onGround = false;
    scene.update({ red: noInput(), blue: noInput() }); // release the jump key held from spawn

    for (let tick = 0; tick < 5; tick++) {
      scene.update({ red: { left: false, right: false, jump: jumpHeldDuringStomp }, blue: noInput() });
      if (red.velocityY < 0) return red.velocityY;
    }
    throw new Error('the stomp never bounced the stomper');
  }

  const bounceHoldingJump = stompAndBounce(true);
  const bounceWithoutJump = stompAndBounce(false);

  assert.ok(
    bounceHoldingJump < bounceWithoutJump,
    'holding jump should launch the stomper higher (a more negative velocity)',
  );
});

test('a fast fall still lands a stomp at every drop height from 30 to 100 px', () => {
  for (let dropHeight = 30; dropHeight <= 100; dropHeight++) {
    const scene = new VersusScene();
    advance(scene, READY_TICKS);

    const red = findPlayer(scene, 'red');
    const blue = findPlayer(scene, 'blue');
    blue.x = 150;
    blue.y = 60;
    blue.onGround = true;
    red.x = 150;
    red.y = blue.y - dropHeight;
    red.previousY = red.y;
    red.velocityY = 6; // already at max fall speed, the fastest a player can fall
    red.onGround = false;

    const stompEvents = [];
    scene.events.on('player-stomped', (event) => stompEvents.push(event));

    const ticksToLand = Math.ceil(dropHeight / 6) + 3;
    for (let tick = 0; tick < ticksToLand; tick++) {
      scene.update({ red: noInput(), blue: noInput() });
    }

    assert.equal(stompEvents.length, 1, `drop height ${dropHeight}px should land exactly one stomp`);
  }
});

test('a running jump from a side platform lands on the middle platform', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const runTicksBeforeJump = 20;
  const jumpHoldTicks = 20;
  for (let tick = 0; tick < 60; tick++) {
    const jump = tick >= runTicksBeforeJump && tick < runTicksBeforeJump + jumpHoldTicks;
    scene.update({ red: { left: false, right: true, jump }, blue: noInput() });
  }

  const red = findPlayer(scene, 'red');
  assert.equal(red.onGround, true);
  assert.equal(red.inWater, false);
  assert.equal(red.y, 60); // standing on the middle platform (y 72, player height 12)
  assert.ok(red.x + red.width > 128 && red.x < 192, 'red should be within the middle platform bounds');
});

test('startInFightPhase skips the Ready countdown for the first round only', () => {
  const scene = new VersusScene({ startInFightPhase: true });
  assert.equal(scene.phase, 'fight');

  findPlayer(scene, 'red').y = 300;
  scene.update(neutralInputs());
  assert.equal(scene.phase, 'point');

  advance(scene, 90); // point pause resolves into the next round
  assert.equal(scene.phase, 'ready');
});
