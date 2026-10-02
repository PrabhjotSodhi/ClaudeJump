import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findCharacter } from '../src/entities/characters.js';
import { stateHash } from '../src/engine/state-hash.js';
import { LevelSelectScene } from '../src/scenes/level-select-scene.js';
import { PlayerSelectScene } from '../src/scenes/player-select-scene.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { arenaLevels } from './fixtures/arena-levels.mjs';
import { harborLevel } from './fixtures/harbor-level.mjs';

// Twenty minutes of play: far longer than any match the computer players have needed, so a match that never ends
// fails instead of hanging.
const MOST_MATCH_TICKS = 60 * 60 * 20;
const STILL = { left: false, right: false, jump: false, action: false };

function computerMatch(level, seed) {
  const players = [
    { id: 'red', character: findCharacter('claude'), computer: true },
    { id: 'blue', character: findCharacter('meta'), computer: true },
  ];
  const scene = new VersusScene({ level, seed, players });
  let ticks = 0;
  while (scene.phase !== 'match' && ticks < MOST_MATCH_TICKS) {
    scene.update({});
    ticks++;
  }
  return { scene, ticks };
}

test('a match with only computer players finishes with a winner on every arena', () => {
  for (const [name, level] of Object.entries(arenaLevels)) {
    const { scene } = computerMatch(level, 3);
    assert.equal(scene.phase, 'match', `${name} finished`);
    assert.ok(Object.values(scene.wins).includes(scene.winsNeeded), `${name} has a winner`);
  }
});

test('the same seed plays a computer match out the same way', () => {
  const first = computerMatch(harborLevel, 9);
  const second = computerMatch(harborLevel, 9);

  assert.equal(first.ticks, second.ticks);
  assert.deepEqual(first.scene.wins, second.scene.wins);
  assert.equal(stateHash(first.scene), stateHash(second.scene));
});

test('a computer player never walks into the sea on its own', () => {
  for (const [name, level] of Object.entries(arenaLevels)) {
    for (const seed of [1, 2, 3]) {
      // A still opponent never shoves, so until the sea starts to rise nothing but the computer moves it.
      const players = [
        { id: 'red', character: findCharacter('claude'), computer: true },
        { id: 'blue', character: findCharacter('meta') },
      ];
      const scene = new VersusScene({ level, seed, players });
      const falls = [];
      scene.events.on('player-fell-in-water', ({ playerId }) => falls.push(playerId));
      scene.events.on('trap-sprung', () => falls.push('hazard'));
      while (scene.suddenDeathPhase === 'none' && !falls.includes('blue')) scene.update({ blue: STILL });

      assert.ok(!falls.includes('red') || falls.indexOf('hazard') >= 0, `${name} seed ${seed}: the computer fell in`);
    }
  }
});

function press(scene, playerId, control) {
  const idle = { red: { ...STILL }, blue: { ...STILL } };
  scene.update({ ...idle, [playerId]: { ...STILL, [control]: true } });
  scene.update(idle);
}

test('on player select a ready player adds a computer player with right and removes it with left', () => {
  const scenes = [];
  const scene = new PlayerSelectScene({
    sceneManager: { setScene: (nextScene) => scenes.push(nextScene) },
    levels: [harborLevel],
    seed: 0,
  });
  scene.update({ red: STILL, blue: STILL });
  press(scene, 'red', 'jump');
  press(scene, 'red', 'jump');

  press(scene, 'red', 'right');
  press(scene, 'red', 'right');
  assert.deepEqual(scene.computerPlayerIds, ['blue', 'green']);
  press(scene, 'red', 'left');
  assert.deepEqual(scene.computerPlayerIds, ['blue']);
  assert.notEqual(scene.characterIndexByPlayerId.blue, scene.characterIndexByPlayerId.red, 'a free character');

  for (let tick = 0; tick < 200 && scenes.length === 0; tick++) scene.update({ red: STILL, blue: STILL });
  assert.deepEqual(scenes[0].computerPlayerIds, ['blue']);
  assert.deepEqual(Object.keys(scenes[0].characterByPlayerId), ['red', 'blue']);
});

test('computer players do not vote on a level but play the match', () => {
  const scenes = [];
  const scene = new LevelSelectScene({
    sceneManager: { setScene: (nextScene) => scenes.push(nextScene) },
    levels: [harborLevel],
    characterByPlayerId: { red: findCharacter('claude'), blue: findCharacter('meta') },
    computerPlayerIds: ['blue'],
    seed: 0,
  });
  scene.update({ red: STILL, blue: STILL });
  press(scene, 'red', 'jump');
  for (let tick = 0; tick < 120 && scenes.length === 0; tick++) scene.update({ red: STILL, blue: STILL });

  const match = scenes[0].matchScene;
  assert.deepEqual(
    match.joinedPlayers.map(({ id, computer }) => ({ id, computer })),
    [
      { id: 'red', computer: false },
      { id: 'blue', computer: true },
    ],
  );
});
