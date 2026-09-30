import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BOMB_FUSE_MAX_TICKS, BOMB_FUSE_MIN_TICKS, BOMB_PASS_BACK_TICKS } from '../src/engine/config.js';
import { stateHash } from '../src/engine/state-hash.js';
import { CHARACTERS } from '../src/entities/characters.js';
import { PLAYERS } from '../src/levels/versus-arena.js';
import { MATCH_MODES } from '../src/scenes/match-modes.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { sparkFlickerTicks } from '../src/vfx/held-bomb.js';
import { harborLevel } from './fixtures/harbor-level.mjs';

const IDLE = { left: false, right: false, jump: false };
// Harbor's left island runs from x 80 to 256, with its top at y 224.
const ISLAND_TOP_Y = 224;

function bombScene(playerCount = 2, seed = 6) {
  const players = PLAYERS.slice(0, playerCount).map(({ id }, index) => ({ id, character: CHARACTERS[index] }));
  return new VersusScene({ level: harborLevel, startInFightPhase: true, seed, players, mode: 'bomb' });
}

function advance(scene, tickCount) {
  for (let tick = 0; tick < tickCount; tick++) {
    scene.update(Object.fromEntries(scene.players.map(({ id }) => [id, IDLE])));
  }
}

function findPlayer(scene, id) {
  return scene.players.find((player) => player.id === id);
}

function standAt(player, x) {
  player.x = x;
  player.y = ISLAND_TOP_Y - player.height;
  player.velocityX = 0;
  player.velocityY = 0;
}

function holder(scene) {
  return findPlayer(scene, scene.modeRules.holderId);
}

test('Pass the bomb is on the mode choice', () => {
  assert.ok(MATCH_MODES.some((mode) => mode.id === 'bomb'));
});

test('one player starts holding a bomb with a fuse inside the range', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const scene = bombScene(4, seed);
    const { holderId, fuseTicksRemaining } = scene.modeRules;
    assert.ok(scene.players.some((player) => player.id === holderId));
    assert.ok(fuseTicksRemaining >= BOMB_FUSE_MIN_TICKS && fuseTicksRemaining <= BOMB_FUSE_MAX_TICKS);
  }
});

test('touching another player passes the bomb', () => {
  const scene = bombScene(3);
  const bombHolder = holder(scene);
  const others = scene.players.filter((player) => player !== bombHolder);
  standAt(bombHolder, 100);
  standAt(others[0], 110);
  standAt(others[1], 200);
  const passes = [];
  scene.events.on('bomb-passed', (event) => passes.push(event));

  advance(scene, 1);

  assert.deepEqual(passes, [{ fromId: bombHolder.id, toId: others[0].id }]);
  assert.equal(scene.modeRules.holderId, others[0].id);
});

test('a player who just passed the bomb cannot get it back for a second', () => {
  const scene = bombScene();
  const passer = holder(scene);
  const receiver = scene.players.find((player) => player !== passer);
  standAt(passer, 100);
  standAt(receiver, 110);
  advance(scene, 1);
  assert.equal(scene.modeRules.holderId, receiver.id);

  advance(scene, BOMB_PASS_BACK_TICKS - 1);
  assert.equal(scene.modeRules.holderId, receiver.id, 'still touching, but the pass back waits');

  advance(scene, 1);
  assert.equal(scene.modeRules.holderId, passer.id, 'the bomb goes back once the second is up');
});

test('when the fuse runs out the holder is blown out and a new bomb goes to someone still standing', () => {
  const scene = bombScene(3);
  const bombHolder = holder(scene);
  const others = scene.players.filter((player) => player !== bombHolder);
  standAt(bombHolder, 100);
  standAt(others[0], 130);
  standAt(others[1], 230);
  const blasts = [];
  scene.events.on('bomb-exploded', (event) => blasts.push(event));
  scene.modeRules.fuseTicksRemaining = 2;

  advance(scene, 1);
  assert.equal(bombHolder.inWater, false);
  advance(scene, 1);

  assert.equal(bombHolder.inWater, true, 'the holder is out of the round');
  assert.equal(blasts.length, 1);
  assert.deepEqual(blasts[0].playerIds, [others[0].id], 'the blast knocks back only the player close by');
  assert.ok(
    others.some((player) => player.id === scene.modeRules.holderId),
    'a standing player gets the new bomb',
  );
  assert.equal(scene.phase, 'fight');
});

test('the last player standing wins the round', () => {
  const scene = bombScene();
  const bombHolder = holder(scene);
  const other = scene.players.find((player) => player !== bombHolder);
  standAt(bombHolder, 100);
  standAt(other, 400);
  scene.modeRules.fuseTicksRemaining = 1;

  advance(scene, 100);

  assert.equal(scene.winnerId, other.id);
  assert.equal(scene.wins[other.id], 1);
});

test('the fuse spark flickers faster near the end', () => {
  assert.ok(sparkFlickerTicks(20) < sparkFlickerTicks(80));
  assert.ok(sparkFlickerTicks(80) < sparkFlickerTicks(400));
});

test('a player blown up by the fuse goes out in a blast cloud with a callout', () => {
  const scene = bombScene(3);
  const blownUp = holder(scene);
  const others = scene.players.filter((player) => player !== blownUp);
  standAt(blownUp, 100);
  standAt(others[0], 180);
  standAt(others[1], 240);
  scene.modeRules.fuseTicksRemaining = 1;
  advance(scene, 1);

  assert.equal(blownUp.blownUp, true);
  assert.equal(scene.callouts.current.text, 'Boom!');
  const [cloud] = scene.blastClouds.activeClouds(scene.tickCount);
  assert.equal(cloud.x, Math.round(blownUp.x + blownUp.width / 2));
  advance(scene, 60);
  assert.equal(scene.blastClouds.activeClouds(scene.tickCount).length, 0);
});

test('the same inputs give the same bomb state', () => {
  function run() {
    const scene = bombScene(4, 11);
    for (let tick = 0; tick < 900; tick++) {
      scene.update({
        red: { ...IDLE, right: tick % 80 < 40, jump: tick % 45 === 0 },
        blue: { ...IDLE, left: tick % 60 < 35 },
        green: { ...IDLE, right: tick % 100 < 20 },
        yellow: IDLE,
      });
    }
    return stateHash(scene);
  }

  assert.equal(run(), run());
});
