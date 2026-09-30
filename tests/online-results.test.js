import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ONLINE_MESSAGE_TICKS } from '../src/engine/config.js';
import { LockstepSession } from '../src/engine/lockstep-session.js';
import { CHARACTERS } from '../src/entities/characters.js';
import { OnlineMatchScene } from '../src/scenes/online-match-scene.js';
import { TitleScene } from '../src/scenes/title-scene.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { resultsMenuRowRectangles } from '../src/ui/results-menu.js';
import { harborLevel } from './fixtures/harbor-level.mjs';
import {
  FakeOnlineConnection,
  fakeSceneManager,
  idleInput,
  pressOnce,
  tapAt,
} from './fixtures/fake-online-connection.mjs';

function startMatch({ isHost }) {
  const connection = new FakeOnlineConnection({ peerIds: ['peer'] });
  const players = [
    { id: 'red', character: CHARACTERS[0] },
    { id: 'blue', character: CHARACTERS[1] },
  ];
  const session = new LockstepSession({
    transport: connection,
    isHost,
    localPlayerId: isHost ? 'red' : 'blue',
    playerIds: ['red', 'blue'],
    playerIdByPeerId: { peer: 'blue' },
    hostPlayerId: 'red',
  });
  const sceneManager = fakeSceneManager();
  const calls = { returned: 0, peersLeft: [] };
  const matchScene = new VersusScene({ level: harborLevel, seed: 3, players, startInFightPhase: true });
  const scene = new OnlineMatchScene({
    sceneManager,
    matchScene,
    session,
    isHost,
    onReturnToLobby: () => calls.returned++,
    onPeerLeft: (peerId) => calls.peersLeft.push(peerId),
  });
  sceneManager.setScene(scene);
  return { scene, sceneManager, connection, calls, matchScene };
}

// The match is over and the results are up. The first tick only records what is held.
function startResults({ isHost }) {
  const match = startMatch({ isHost });
  match.matchScene.wins.red = 5;
  match.matchScene.winnerId = 'red';
  match.matchScene.phase = 'match';
  match.matchScene.ticksRemaining = 0;
  match.scene.update({ red: idleInput(), blue: idleInput() });
  return match;
}

test('the host sees Rematch and Leave and a joiner sees only Leave', () => {
  assert.deepEqual(
    startResults({ isHost: true }).scene.resultsOptions.map((option) => option.label),
    ['Rematch', 'Leave'],
  );
  assert.deepEqual(
    startResults({ isHost: false }).scene.resultsOptions.map((option) => option.label),
    ['Leave'],
  );
});

test('Rematch tells every device to go back to the lobby and goes back too', () => {
  const { scene, connection, calls } = startResults({ isHost: true });

  pressOnce(scene, { confirm: true });

  assert.equal(calls.returned, 1);
  assert.deepEqual(
    connection.sentOfType('return-to-lobby').map((message) => message.to),
    ['peer'],
  );
  assert.equal(connection.closed, false);
});

test('a joiner goes back to the lobby when the host starts the rematch', () => {
  const { connection, calls } = startResults({ isHost: false });

  connection.onMessage('peer', { type: 'return-to-lobby' });

  assert.equal(calls.returned, 1);
});

test('a joiner cannot send anyone back to the lobby', () => {
  const { scene, connection, calls } = startResults({ isHost: false });
  connection.onMessage('peer', { type: 'return-to-lobby' });
  calls.returned = 0;

  connection.onMessage('peer', { type: 'input' });
  pressOnce(scene, { confirm: true });

  assert.equal(connection.sentOfType('return-to-lobby').length, 0);
});

test('a joiner who is not the host ignores a return message from anyone else in a host scene', () => {
  const { connection, calls } = startResults({ isHost: true });

  connection.onMessage('peer', { type: 'return-to-lobby' });

  assert.equal(calls.returned, 0);
});

test('Leave closes the connection and returns to the title', () => {
  const { scene, sceneManager, connection } = startResults({ isHost: true });

  pressOnce(scene, { down: true });
  pressOnce(scene, { confirm: true });

  assert.equal(connection.closed, true);
  assert.ok(sceneManager.currentScene instanceof TitleScene);
});

test('tapping Leave works too', () => {
  const { scene, sceneManager } = startResults({ isHost: false });
  const [leaveRow] = resultsMenuRowRectangles(scene.resultsOptions);

  tapAt(scene, leaveRow.x + 10, leaveRow.y + 4);

  assert.ok(sceneManager.currentScene instanceof TitleScene);
});

test('a joiner who leaves from the results is passed to the host lobby', () => {
  const { connection, calls } = startResults({ isHost: true });

  connection.onPeerClose('peer');

  assert.deepEqual(calls.peersLeft, ['peer']);
});

test('when the host leaves from the results a joiner gets a message and returns to the title', () => {
  const { scene, sceneManager, connection } = startResults({ isHost: false });

  connection.onPeerClose('peer');

  assert.deepEqual(scene.messageLines(), ['The host left', 'Returning to the title']);
  for (let tick = 0; tick < ONLINE_MESSAGE_TICKS - 1; tick++) scene.update({ red: idleInput() });
  assert.equal(sceneManager.currentScene, scene);
  scene.update({ red: idleInput() });
  assert.ok(sceneManager.currentScene instanceof TitleScene);
  assert.equal(connection.closed, true);
});

test('a confirm still held when the results appear does not choose an option', () => {
  const match = startMatch({ isHost: true });
  match.matchScene.wins.red = 5;
  match.matchScene.winnerId = 'red';
  match.matchScene.phase = 'match';
  match.matchScene.ticksRemaining = 0;

  match.scene.update({ red: { ...idleInput(), confirm: true }, blue: idleInput() });
  match.scene.update({ red: { ...idleInput(), confirm: true }, blue: idleInput() });

  assert.equal(match.calls.returned, 0);
  assert.equal(match.sceneManager.currentScene, match.scene);
});

test('pause does nothing online, the match keeps running', () => {
  const connection = new FakeOnlineConnection();
  const session = new LockstepSession({
    transport: connection,
    isHost: true,
    localPlayerId: 'red',
    playerIds: ['red'],
    hostPlayerId: 'red',
  });
  const matchScene = new VersusScene({
    level: harborLevel,
    seed: 3,
    players: [{ id: 'red', character: CHARACTERS[0] }],
    startInFightPhase: true,
  });
  const scene = new OnlineMatchScene({ sceneManager: fakeSceneManager(), matchScene, session });

  for (let tick = 0; tick < 30; tick++) scene.update({ red: { ...idleInput(), pause: true }, blue: idleInput() });

  assert.ok(matchScene.tickCount >= 25);
});

test('either keyboard side drives the one local player', () => {
  const { scene, connection, matchScene } = startMatch({ isHost: true });
  for (let tick = 4; tick < 60; tick++) connection.onMessage('peer', { type: 'input', tick, input: {} });
  const startX = matchScene.players[0].x;

  for (let tick = 0; tick < 30; tick++) scene.update({ red: idleInput(), blue: { ...idleInput(), right: true } });

  assert.ok(matchScene.players[0].x > startX);
});
