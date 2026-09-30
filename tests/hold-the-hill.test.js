import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HILL_RESPAWN_TICKS, HILL_ROUND_TICKS, HILL_ZONE_MOVE_TICKS, TICK_RATE } from '../src/engine/config.js';
import { stateHash } from '../src/engine/state-hash.js';
import { CHARACTERS } from '../src/entities/characters.js';
import { PLAYERS } from '../src/levels/versus-arena.js';
import { ModeSelectScene } from '../src/scenes/mode-select-scene.js';
import { OnlineLobby } from '../src/scenes/online-lobby-state.js';
import { versusSceneOptionsFromSetup } from '../src/scenes/online-match-setup.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { harborLevel } from './fixtures/harbor-level.mjs';

const IDLE = { left: false, right: false, jump: false };

function hillScene(playerCount = 2, seed = 4) {
  const players = PLAYERS.slice(0, playerCount).map(({ id }, index) => ({ id, character: CHARACTERS[index] }));
  return new VersusScene({ level: harborLevel, startInFightPhase: true, seed, players, mode: 'hill' });
}

function idleInputs(scene) {
  return Object.fromEntries(scene.players.map(({ id }) => [id, IDLE]));
}

function advance(scene, tickCount) {
  for (let tick = 0; tick < tickCount; tick++) scene.update(idleInputs(scene));
}

// Puts the player standing in the middle of the zone.
function standInZone(scene, player) {
  const { zone } = scene.modeRules;
  player.x = zone.x + zone.width / 2 - player.width / 2;
  player.y = zone.y + zone.height - player.height;
  player.velocityX = 0;
  player.velocityY = 0;
}

// Parks the player on their own spawn, which is never inside the zone on Harbor's islands at these seeds.
function standAway(scene, player) {
  const { zone } = scene.modeRules;
  const openTop = scene.openTops.find((top) => top.x + top.width <= zone.x || top.x >= zone.x + zone.width);
  player.x = openTop.x + 4;
  player.y = openTop.y - player.height;
}

function holdZone(scene, holders, tickCount) {
  for (let tick = 0; tick < tickCount; tick++) {
    for (const player of scene.players) {
      if (holders.includes(player)) standInZone(scene, player);
      else standAway(scene, player);
    }
    scene.update(idleInputs(scene));
  }
}

test('a player alone in the zone earns a point every tick', () => {
  const scene = hillScene(3);
  const [red, blue, green] = scene.players;

  holdZone(scene, [blue], 90);

  assert.deepEqual(scene.modeRules.pointsByPlayerId, { [red.id]: 0, [blue.id]: 90, [green.id]: 0 });
});

test('a contested zone earns nothing for anyone', () => {
  const scene = hillScene(3);
  const [red, blue, green] = scene.players;

  holdZone(scene, [red, green], 90);

  assert.deepEqual(scene.modeRules.pointsByPlayerId, { [red.id]: 0, [blue.id]: 0, [green.id]: 0 });
});

test('the zone moves to its marked spot every ten seconds', () => {
  const scene = hillScene();
  const moves = [];
  scene.events.on('hill-moved', (event) => moves.push(event));
  const firstZone = scene.modeRules.zone;
  const markedZone = scene.modeRules.nextZone;
  assert.notDeepEqual(markedZone, firstZone, 'the marker points somewhere new');

  advance(scene, HILL_ZONE_MOVE_TICKS - 1);
  assert.deepEqual(scene.modeRules.zone, firstZone);

  advance(scene, 1);
  assert.deepEqual(scene.modeRules.zone, markedZone);
  assert.equal(moves.length, 1);
  assert.notDeepEqual(scene.modeRules.nextZone, markedZone);
});

test('the most points when time runs out wins the round, with no sudden death', () => {
  const scene = hillScene(4);
  const [red, blue, green, yellow] = scene.players;
  const suddenDeaths = [];
  scene.events.on('sudden-death-started', () => suddenDeaths.push(true));

  holdZone(scene, [green], 5 * TICK_RATE);
  holdZone(scene, [yellow], 3 * TICK_RATE);
  advance(scene, HILL_ROUND_TICKS - 8 * TICK_RATE - 1);
  assert.equal(scene.phase, 'fight');

  advance(scene, 1);
  assert.equal(scene.phase, 'point');
  assert.equal(scene.winnerId, green.id);
  assert.deepEqual(scene.wins, { [red.id]: 0, [blue.id]: 0, [green.id]: 1, [yellow.id]: 0 });
  assert.equal(suddenDeaths.length, 0);
});

test('a knocked out player comes back at their spawn after two seconds', () => {
  const scene = hillScene();
  const red = scene.players[0];
  const spawn = harborLevel.spawns.find((candidate) => candidate.id === red.id);
  red.y = scene.waterLineY;
  advance(scene, 1);
  assert.equal(scene.players[0].inWater, true);

  advance(scene, HILL_RESPAWN_TICKS - 2);
  assert.equal(scene.players[0].inWater, true);
  advance(scene, 1);

  const respawned = scene.players[0];
  assert.equal(respawned.id, red.id);
  assert.equal(respawned.inWater, false);
  assert.equal(respawned.x + respawned.width / 2, spawn.x);
  assert.equal(scene.phase, 'fight', 'being alone on the map does not end a hill round');
});

test('the same inputs give the same hill state', () => {
  function run() {
    const scene = hillScene(3, 9);
    for (let tick = 0; tick < 700; tick++) {
      scene.update({
        red: { ...IDLE, right: tick % 90 < 45, jump: tick % 50 === 0 },
        blue: { ...IDLE, left: tick % 70 < 30 },
        green: IDLE,
      });
    }
    return stateHash(scene);
  }

  assert.equal(run(), run());
});

test('picking Hold the hill on the mode choice carries it to the match', () => {
  let currentScene = null;
  const sceneManager = { setScene: (scene) => (currentScene = scene) };
  const characterByPlayerId = { red: CHARACTERS[0], blue: CHARACTERS[1] };
  const modeSelect = new ModeSelectScene({ sceneManager, levels: [harborLevel], characterByPlayerId, seed: 1 });
  const inputs = (input) => ({ red: input, blue: IDLE });

  modeSelect.update(inputs(IDLE));
  modeSelect.update(inputs({ ...IDLE, down: true }));
  modeSelect.update(inputs(IDLE));
  modeSelect.update(inputs({ ...IDLE, confirm: true }));
  assert.equal(currentScene.constructor.name, 'LevelSelectScene');

  const levelSelect = currentScene;
  levelSelect.update(inputs(IDLE));
  levelSelect.update({ red: { ...IDLE, jump: true }, blue: { ...IDLE, jump: true } });
  for (let tick = 0; tick < 120 && currentScene === levelSelect; tick++) levelSelect.update(inputs(IDLE));

  assert.equal(currentScene.matchScene.mode, 'hill');
});

test('the host picks the mode online and every device builds the match with it', () => {
  const lobby = new OnlineLobby({ levelNames: [harborLevel.name] });
  lobby.join('host');
  lobby.join('peer');
  lobby.changeMode(1);

  const joinerLobby = new OnlineLobby({ levelNames: [harborLevel.name] });
  joinerLobby.load(lobby.snapshot());
  assert.equal(joinerLobby.modeId, 'hill');

  const setup = lobby.matchSetup(3);
  const options = versusSceneOptionsFromSetup(JSON.parse(JSON.stringify(setup)), [harborLevel]);
  assert.equal(new VersusScene(options).mode, 'hill');
});
