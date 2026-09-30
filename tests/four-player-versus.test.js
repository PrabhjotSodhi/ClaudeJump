import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCREEN_WIDTH } from '../src/engine/config.js';
import { stateHash } from '../src/engine/state-hash.js';
import { BOUNCE_PAD_WIDTH } from '../src/entities/bounce-pad.js';
import { CHARACTERS } from '../src/entities/characters.js';
import { PLAYER_HEIGHT, PLAYER_WIDTH } from '../src/entities/player.js';
import { PLAYERS } from '../src/levels/versus-arena.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { arenaLevels } from './fixtures/arena-levels.mjs';
import { harborLevel } from './fixtures/harbor-level.mjs';

const READY_TICKS = 60;
const POINT_PAUSE_TICKS = 90;
const WINS_NEEDED = 5;
// Harbor's two islands leave room for exactly this much between a new spawn and its neighbor.
const MINIMUM_SPAWN_DISTANCE = 60;

function joinedPlayers(playerCount) {
  return PLAYERS.slice(0, playerCount).map(({ id }, index) => ({ id, character: CHARACTERS[index] }));
}

function newScene(playerCount) {
  return new VersusScene({ level: harborLevel, seed: 0, players: joinedPlayers(playerCount) });
}

function idleInputs(scene) {
  return Object.fromEntries(scene.players.map((player) => [player.id, { left: false, right: false, jump: false }]));
}

function advance(scene, tickCount) {
  for (let tick = 0; tick < tickCount; tick++) scene.update(idleInputs(scene));
}

function findPlayer(scene, id) {
  return scene.players.find((player) => player.id === id);
}

function dropIntoSea(scene, ...ids) {
  for (const id of ids) findPlayer(scene, id).y = 600;
  scene.update(idleInputs(scene));
}

test('only the joined players spawn, in seat order', () => {
  assert.deepEqual(
    newScene(2).players.map((player) => player.id),
    ['red', 'blue'],
  );
  assert.deepEqual(
    newScene(4).players.map((player) => player.id),
    ['red', 'blue', 'green', 'yellow'],
  );
});

test('a 2 player match plays as it always did: only red and blue spawn and one fall ends the round', () => {
  const defaultScene = new VersusScene({ level: harborLevel, seed: 0 });
  const explicitScene = newScene(2);
  for (const scene of [defaultScene, explicitScene]) {
    assert.deepEqual(
      scene.players.map((player) => [player.id, player.x, player.y]),
      [
        ['red', 140, 196],
        ['blue', 476, 196],
      ],
    );
    advance(scene, READY_TICKS);
    dropIntoSea(scene, 'red');
    assert.equal(scene.phase, 'point');
    assert.equal(scene.winnerId, 'blue');
    assert.deepEqual(scene.wins, { red: 0, blue: 1 });
  }
  assert.equal(stateHash(defaultScene), stateHash(explicitScene));
});

test('a 4 player round ends when three players fall', () => {
  const scene = newScene(4);
  advance(scene, READY_TICKS);

  dropIntoSea(scene, 'red');
  dropIntoSea(scene, 'blue');
  assert.equal(scene.phase, 'fight', 'two players are still standing');

  dropIntoSea(scene, 'green');
  assert.equal(scene.phase, 'point');
  assert.equal(scene.winnerId, 'yellow');
  assert.deepEqual(scene.wins, { red: 0, blue: 0, green: 0, yellow: 1 });
});

test('a round where the last players fall together is a draw', () => {
  const scene = newScene(3);
  advance(scene, READY_TICKS);

  dropIntoSea(scene, 'red', 'blue', 'green');

  assert.equal(scene.phase, 'point');
  assert.equal(scene.winnerId, null);
  assert.deepEqual(scene.wins, { red: 0, blue: 0, green: 0 });
});

test('a 3 player match reaches 5 wins', () => {
  const scene = newScene(3);

  for (let win = 1; win <= WINS_NEEDED; win++) {
    advance(scene, READY_TICKS);
    dropIntoSea(scene, 'red');
    assert.equal(scene.phase, 'fight', 'the round goes on while two players stand');
    assert.equal(scene.winnerId, null);
    assert.equal(scene.wins.blue, win - 1);

    dropIntoSea(scene, 'green');
    assert.equal(scene.phase, win < WINS_NEEDED ? 'point' : 'match', 'the round ends with one player standing');
    assert.equal(scene.winnerId, 'blue');
    assert.equal(scene.wins.blue, win);
    if (win < WINS_NEEDED) {
      assert.equal(scene.phase, 'point');
      advance(scene, POINT_PAUSE_TICKS);
    }
  }

  assert.equal(scene.phase, 'match');
  assert.equal(scene.winnerId, 'blue');
});

test('match stats count falls for every player in the match', () => {
  const scene = newScene(4);
  advance(scene, READY_TICKS);

  dropIntoSea(scene, 'green');
  dropIntoSea(scene, 'yellow');

  assert.deepEqual(scene.matchStats.fallsIn, { red: 0, blue: 0, green: 1, yellow: 1 });
});

test('a shove knocks back every other player it touches, not only the first', () => {
  const scene = newScene(3);
  advance(scene, READY_TICKS);
  const shover = findPlayer(scene, 'red');
  shover.x = 264;
  shover.y = 116;
  shover.onGround = true;
  shover.facing = 1;
  for (const id of ['blue', 'green']) {
    const target = findPlayer(scene, id);
    target.x = 300;
    target.y = 116;
    target.onGround = true;
  }

  const shoved = [];
  scene.events.on('player-shoved', (event) => shoved.push(event.targetId));
  scene.update(idleInputs(scene));
  const inputs = idleInputs(scene);
  inputs.red.action = true;
  scene.update(inputs);
  advance(scene, 2);

  assert.deepEqual(shoved.sort(), ['blue', 'green']);
});

test('a dash knocks apart any pair of players that touch', () => {
  const scene = newScene(4);
  advance(scene, READY_TICKS);
  const dasher = findPlayer(scene, 'green');
  const target = findPlayer(scene, 'yellow');
  dasher.dashTicksRemaining = 5;
  target.x = dasher.x + dasher.width / 2;
  target.y = dasher.y;

  const hits = [];
  scene.events.on('dash-hit', (event) => hits.push([...event.playerIds].sort()));
  scene.update(idleInputs(scene));

  assert.deepEqual(hits, [['green', 'yellow']]);
});

function overlaps(first, second) {
  return (
    first.x < second.x + second.width &&
    second.x < first.x + first.width &&
    first.y < second.y + second.height &&
    second.y < first.y + first.height
  );
}

for (const [fileName, level] of Object.entries(arenaLevels)) {
  test(`${fileName} has four spawns that stand on ground, do not overlap and are not boxed in`, () => {
    assert.deepEqual(
      level.spawns.map((spawn) => spawn.id),
      ['red', 'blue', 'green', 'yellow'],
    );
    const bodies = level.spawns.map((spawn) => ({
      id: spawn.id,
      x: spawn.x - PLAYER_WIDTH / 2,
      y: spawn.y - PLAYER_HEIGHT,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
    }));

    for (const body of bodies) {
      const standsOnPlatform = level.platforms.some(
        (platform) =>
          platform.y === body.y + body.height &&
          platform.x <= body.x &&
          body.x + body.width <= platform.x + platform.width,
      );
      assert.ok(standsOnPlatform, `${body.id} stands on a platform`);
      assert.ok(!level.platforms.some((platform) => overlaps(platform, body)), `${body.id} is not inside stone`);
      assert.ok(body.y >= 0 && body.x >= 0 && body.x + body.width <= SCREEN_WIDTH, `${body.id} is on screen`);
    }
    bodies.forEach((body, index) => {
      for (const other of bodies.slice(index + 1)) {
        assert.ok(!overlaps(body, other), `${body.id} and ${other.id} do not overlap`);
      }
    });
    const [, , green, yellow] = level.spawns;
    assert.equal(green.x, SCREEN_WIDTH - yellow.x, 'the extra spawns mirror each other');
    assert.equal(green.y, yellow.y);
    assert.deepEqual([green.facing, yellow.facing], [1, -1], 'both face the middle');

    const spawnDistance = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);
    level.spawns.forEach((spawn, index) => {
      for (const other of level.spawns.slice(index + 1)) {
        assert.ok(spawnDistance(spawn, other) >= MINIMUM_SPAWN_DISTANCE, `${spawn.id} and ${other.id} start apart`);
      }
    });
    for (const spawn of [green, yellow]) {
      assert.ok(spawn.y > level.suddenDeathLineY, `${spawn.id} does not start on the last ground sudden death leaves`);
      const standsOnPad = level.bouncePads.some((pad) => spawn.x >= pad.x && spawn.x <= pad.x + BOUNCE_PAD_WIDTH);
      assert.ok(!standsOnPad, `${spawn.id} does not start on a bounce pad`);
    }
  });
}
