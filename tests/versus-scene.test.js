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
  for (let i = 0; i < tickCount; i++) scene.update(inputs);
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
