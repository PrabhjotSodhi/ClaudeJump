import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INPUT_DELAY_TICKS, ONLINE_MESSAGE_TICKS } from '../src/engine/config.js';
import { LockstepSession } from '../src/engine/lockstep-session.js';
import { stateHash } from '../src/engine/state-hash.js';
import { CHARACTERS } from '../src/entities/characters.js';
import { OnlineMatchScene } from '../src/scenes/online-match-scene.js';
import { listenForMatchSetup, sendMatchSetup, versusSceneOptionsFromSetup } from '../src/scenes/online-match-setup.js';
import { TitleScene } from '../src/scenes/title-scene.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { harborLevel } from './fixtures/harbor-level.mjs';
import { SimulatedNetwork } from './fixtures/simulated-network.mjs';

const RUN_RIGHT = { red: { right: true }, blue: {} };

function startPair() {
  const network = new SimulatedNetwork({ seed: 5, maxDelaySteps: 2 });
  const hostTransport = network.addTransport('red', ['blue']);
  const joinerTransport = network.addTransport('blue', ['red']);
  const players = [
    { id: 'red', character: CHARACTERS[0] },
    { id: 'blue', character: CHARACTERS[1] },
  ];
  const [host, joiner] = [
    { transport: hostTransport, isHost: true, localPlayerId: 'red', controlId: 'red' },
    { transport: joinerTransport, isHost: false, localPlayerId: 'blue', controlId: 'blue' },
  ].map(({ transport, isHost, localPlayerId, controlId }) => {
    const session = new LockstepSession({
      transport,
      isHost,
      localPlayerId,
      playerIds: ['red', 'blue'],
      playerIdByPeerId: { blue: 'blue' },
      hostPlayerId: 'red',
    });
    const sceneManager = {
      setScene(scene) {
        this.currentScene = scene;
      },
    };
    const matchScene = new VersusScene({ level: harborLevel, seed: 3, players, startInFightPhase: true });
    sceneManager.currentScene = new OnlineMatchScene({ sceneManager, matchScene, session, controlId });
    return sceneManager;
  });
  return { network, host, joiner };
}

function tickBoth({ network, host, joiner }, inputByPlayerId) {
  network.advance();
  host.currentScene.update(inputByPlayerId);
  joiner.currentScene.update(inputByPlayerId);
}

test('two online scenes fed only local keys stay in step', () => {
  const pair = startPair();
  const hostScene = pair.host.currentScene;
  const joinerScene = pair.joiner.currentScene;
  const keys = { red: { right: true, jump: false }, blue: { left: true, jump: false } };
  for (let step = 0; step < 300; step++) tickBoth(pair, keys);

  assert.ok(hostScene.matchScene.tickCount > 200);
  assert.equal(hostScene.matchScene.tickCount, joinerScene.matchScene.tickCount);
  assert.equal(stateHash(hostScene.matchScene), stateHash(joinerScene.matchScene));
});

test('the match stops after the idle delay ticks while the other device is silent', () => {
  const pair = startPair();
  for (let step = 0; step < 100; step++) {
    pair.network.advance();
    pair.host.currentScene.update(RUN_RIGHT);
  }
  assert.equal(pair.host.currentScene.matchScene.tickCount, INPUT_DELAY_TICKS);
});

test('a disconnect shows a message and returns to the title after a few seconds', () => {
  const pair = startPair();
  for (let step = 0; step < 20; step++) tickBoth(pair, RUN_RIGHT);
  const scene = pair.joiner.currentScene;
  pair.network.transports.get('red').close();

  assert.equal(scene.session.status, 'disconnected');
  assert.deepEqual(scene.messageLines(), ['red disconnected', 'Returning to the title']);
  for (let tick = 0; tick < ONLINE_MESSAGE_TICKS - 1; tick++) scene.update(RUN_RIGHT);
  assert.equal(pair.joiner.currentScene, scene);
  scene.update(RUN_RIGHT);
  assert.ok(pair.joiner.currentScene instanceof TitleScene);
});

test('a desync shows a message and ends the match on both devices', () => {
  const pair = startPair();
  for (let step = 0; step < 100; step++) tickBoth(pair, RUN_RIGHT);
  pair.joiner.currentScene.matchScene.players[0].x += 1;
  for (let step = 0; step < 100; step++) tickBoth(pair, RUN_RIGHT);

  for (const sceneManager of [pair.host, pair.joiner]) {
    assert.deepEqual(sceneManager.currentScene.messageLines(), ['Out of sync', 'The match has ended']);
  }
});

test('the joiner builds the scene the host chose from the setup message', () => {
  const network = new SimulatedNetwork({ seed: 1, maxDelaySteps: 2 });
  const hostTransport = network.addTransport('red', ['blue']);
  const joinerTransport = network.addTransport('blue', ['red']);
  const setup = {
    seed: 99,
    levelName: harborLevel.name,
    players: [
      { id: 'red', characterName: CHARACTERS[2].name },
      { id: 'blue', characterName: CHARACTERS[3].name },
    ],
  };
  let received = null;
  listenForMatchSetup(joinerTransport, (message) => (received = message));
  sendMatchSetup(hostTransport, setup);
  for (let step = 0; step < 3; step++) network.advance();

  const options = versusSceneOptionsFromSetup(received, [harborLevel]);
  assert.equal(options.seed, 99);
  assert.equal(options.level, harborLevel);
  assert.deepEqual(
    options.players.map(({ id, character }) => [id, character.name]),
    [
      ['red', CHARACTERS[2].name],
      ['blue', CHARACTERS[3].name],
    ],
  );
});
