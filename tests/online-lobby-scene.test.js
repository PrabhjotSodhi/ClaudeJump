import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OnlineLobbyScene } from '../src/scenes/online-lobby-scene.js';
import { OnlineMatchScene } from '../src/scenes/online-match-scene.js';
import { harborLevel } from './fixtures/harbor-level.mjs';
import { FakeOnlineConnection, fakeSceneManager, idleInput, pressOnce } from './fixtures/fake-online-connection.mjs';

const LEVELS = [harborLevel, { ...harborLevel, name: 'cave' }];
const ROW_READY = 1;
const ROW_START = 4;
const ROW_LEAVE = 5;

function startLobby({ isHost, connection = new FakeOnlineConnection() }) {
  const sceneManager = fakeSceneManager();
  const calls = { left: 0, hostLeft: 0, errors: [] };
  const scene = new OnlineLobbyScene({
    sceneManager,
    connection,
    isHost,
    levels: LEVELS,
    sprites: {},
    seed: 5,
    onLeave: () => calls.left++,
    onHostLeft: () => calls.hostLeft++,
    onError: (code) => calls.errors.push(code),
  });
  sceneManager.setScene(scene);
  scene.update({ red: idleInput(), blue: idleInput() });
  return { scene, sceneManager, connection, calls };
}

function selectRow(scene, rowIndex) {
  while (scene.selectedRow !== rowIndex) pressOnce(scene, { down: true });
}

function readyUpHostWithGuest(lobby) {
  lobby.connection.peerIds = ['guest'];
  lobby.connection.onPeerOpen('guest');
  lobby.connection.onMessage('guest', { type: 'lobby-choice', choice: 'ready', ready: true });
  selectRow(lobby.scene, ROW_READY);
  pressOnce(lobby.scene, { confirm: true });
}

test('a device that connects to the host gets the next seat and is sent the lobby with its seat number', () => {
  const lobby = startLobby({ isHost: true });

  lobby.connection.onPeerOpen('guest');

  assert.equal(lobby.scene.lobby.playerCount, 2);
  const [message] = lobby.connection.sentOfType('lobby-state');
  assert.equal(message.to, 'guest');
  assert.equal(message.data.seat, 1);
  assert.equal(message.data.snapshot.seats[1].ready, false);
});

test('a joiner choosing a character or ready shows up for everyone', () => {
  const lobby = startLobby({ isHost: true });
  lobby.connection.onPeerOpen('guest');
  const before = lobby.scene.lobby.snapshot().seats[1].characterName;
  lobby.connection.sent.length = 0;

  lobby.connection.onMessage('guest', { type: 'lobby-choice', choice: 'character', direction: 1 });
  lobby.connection.onMessage('guest', { type: 'lobby-choice', choice: 'ready', ready: true });

  const seat = lobby.scene.lobby.snapshot().seats[1];
  assert.notEqual(seat.characterName, before);
  assert.equal(seat.ready, true);
  assert.equal(lobby.connection.sentOfType('lobby-state').at(-1).data.snapshot.seats[1].ready, true);
});

test('the host ignores choices that make no sense and messages from strangers', () => {
  const lobby = startLobby({ isHost: true });
  lobby.connection.onPeerOpen('guest');
  const before = JSON.stringify(lobby.scene.lobby.snapshot());
  lobby.connection.sent.length = 0;

  lobby.connection.onMessage('guest', { type: 'lobby-choice', choice: 'character', direction: 40 });
  lobby.connection.onMessage('guest', { type: 'lobby-choice', choice: 'ready', ready: 'yes' });
  lobby.connection.onMessage('guest', { type: 'lobby-choice', choice: 'level', direction: 1 });
  lobby.connection.onMessage('stranger', { type: 'lobby-choice', choice: 'ready', ready: true });
  lobby.connection.onMessage('guest', null);

  assert.equal(JSON.stringify(lobby.scene.lobby.snapshot()), before);
  assert.equal(lobby.connection.sent.length, 0);
});

test('a joiner can never change the level', () => {
  const lobby = startLobby({ isHost: true });
  lobby.connection.onPeerOpen('guest');

  lobby.connection.onMessage('guest', { type: 'lobby-choice', choice: 'level', direction: 1 });

  assert.equal(lobby.scene.lobby.levelName, 'random');
});

test('the host steps the level with Enter on the level row', () => {
  const lobby = startLobby({ isHost: true });
  lobby.connection.onPeerOpen('guest');
  lobby.connection.sent.length = 0;

  selectRow(lobby.scene, 2);
  pressOnce(lobby.scene, { confirm: true });

  assert.equal(lobby.scene.lobby.levelName, harborLevel.name);
  assert.equal(lobby.connection.sentOfType('lobby-state').at(-1).data.snapshot.levelName, harborLevel.name);
});

test('the host cannot start with only one player ready', () => {
  const lobby = startLobby({ isHost: true });
  lobby.connection.onPeerOpen('guest');
  selectRow(lobby.scene, ROW_READY);
  pressOnce(lobby.scene, { confirm: true });

  selectRow(lobby.scene, ROW_START);
  pressOnce(lobby.scene, { confirm: true });

  assert.equal(lobby.sceneManager.currentScene, lobby.scene);
  assert.equal(lobby.connection.sentOfType('match-setup').length, 0);
});

test('with two players ready the host starts a match and tells everyone the setup', () => {
  const lobby = startLobby({ isHost: true });
  readyUpHostWithGuest(lobby);

  selectRow(lobby.scene, ROW_START);
  pressOnce(lobby.scene, { confirm: true });

  const match = lobby.sceneManager.currentScene;
  assert.ok(match instanceof OnlineMatchScene);
  assert.equal(match.isHost, true);
  const [{ data }] = lobby.connection.sentOfType('match-setup');
  assert.deepEqual(
    data.setup.players.map((player) => player.id),
    ['red', 'blue'],
  );
  assert.ok(Number.isInteger(data.setup.seed));
  assert.deepEqual(
    match.matchScene.players.map((player) => player.id),
    ['red', 'blue'],
  );
  assert.equal(match.session.localPlayerId, 'red');
  assert.deepEqual(match.session.playerIdByPeerId, { guest: 'blue' });
  assert.equal(lobby.connection.polling, false);
});

test('a rematch brings the lobby back with the same players and a new seed for the next match', () => {
  const lobby = startLobby({ isHost: true });
  readyUpHostWithGuest(lobby);
  selectRow(lobby.scene, ROW_START);
  pressOnce(lobby.scene, { confirm: true });
  const firstSeed = lobby.connection.sentOfType('match-setup')[0].data.setup.seed;
  const eventsBefore = lobby.scene.events;
  lobby.connection.sent.length = 0;

  lobby.sceneManager.currentScene.onReturnToLobby();

  assert.equal(lobby.sceneManager.currentScene, lobby.scene);
  assert.notEqual(lobby.scene.events, eventsBefore);
  assert.equal(lobby.scene.lobby.playerCount, 2);
  assert.equal(lobby.scene.lobby.canStart(), true);
  assert.equal(lobby.connection.sentOfType('lobby-state').length, 1);
  assert.equal(lobby.connection.polling, true);

  lobby.scene.update({ red: idleInput(), blue: idleInput() });
  pressOnce(lobby.scene, { confirm: true });
  const secondSeed = lobby.connection.sentOfType('match-setup')[0].data.setup.seed;
  assert.notEqual(secondSeed, firstSeed);
  assert.ok(lobby.sceneManager.currentScene instanceof OnlineMatchScene);
});

test('a joiner leaving from the results frees their seat in the host lobby', () => {
  const lobby = startLobby({ isHost: true });
  readyUpHostWithGuest(lobby);
  selectRow(lobby.scene, ROW_START);
  pressOnce(lobby.scene, { confirm: true });

  lobby.sceneManager.currentScene.onPeerLeft('guest');

  assert.equal(lobby.scene.lobby.playerCount, 1);
});

test('a joiner who leaves the lobby frees their seat and everyone sees it', () => {
  const lobby = startLobby({ isHost: true });
  lobby.connection.peerIds = ['first', 'second'];
  lobby.connection.onPeerOpen('first');
  lobby.connection.onPeerOpen('second');
  lobby.connection.sent.length = 0;

  lobby.connection.onPeerClose('first');

  assert.equal(lobby.scene.lobby.playerCount, 2);
  assert.equal(lobby.scene.lobby.seats[1], null);
  assert.deepEqual(
    lobby.connection.sentOfType('lobby-state').map((message) => message.to),
    ['second'],
  );
});

test('leaving closes the connection and goes back', () => {
  const lobby = startLobby({ isHost: true });

  selectRow(lobby.scene, ROW_LEAVE);
  pressOnce(lobby.scene, { confirm: true });

  assert.equal(lobby.connection.closed, true);
  assert.equal(lobby.calls.left, 1);
});

test('a joiner sees the lobby the host sends, and which seat is theirs', () => {
  const lobby = startLobby({ isHost: false, connection: new FakeOnlineConnection({ peerIds: ['host-peer'] }) });
  const snapshot = {
    levelName: 'cave',
    modeId: 'hill',
    seats: [{ characterName: 'claude', ready: true }, null, { characterName: 'gemini', ready: false }, null],
  };

  lobby.connection.onMessage('host-peer', { type: 'lobby-state', snapshot, seat: 2 });

  assert.equal(lobby.scene.localSeat, 2);
  assert.deepEqual(lobby.scene.lobby.snapshot(), snapshot);
});

test('a joiner asks the host to ready up and waits for the host to say so', () => {
  const lobby = startLobby({ isHost: false, connection: new FakeOnlineConnection({ peerIds: ['host-peer'] }) });
  lobby.connection.onMessage('host-peer', {
    type: 'lobby-state',
    snapshot: {
      levelName: 'random',
      seats: [{ characterName: 'claude', ready: false }, { characterName: 'meta', ready: false }, null, null],
    },
    seat: 1,
  });

  selectRow(lobby.scene, ROW_READY);
  pressOnce(lobby.scene, { confirm: true });

  assert.deepEqual(lobby.connection.sent, [
    { to: 'host-peer', data: { type: 'lobby-choice', choice: 'ready', ready: true } },
  ]);
  assert.equal(lobby.scene.lobby.seats[1].ready, false);
});

test('a joiner has no level or start row', () => {
  const lobby = startLobby({ isHost: false });

  assert.deepEqual(lobby.scene.rows, ['character', 'ready', 'leave']);
});

test('a joiner builds the match from the host setup with their own player', () => {
  const lobby = startLobby({ isHost: false, connection: new FakeOnlineConnection({ peerIds: ['host-peer'] }) });
  lobby.connection.onMessage('host-peer', {
    type: 'lobby-state',
    snapshot: {
      levelName: 'random',
      seats: [
        { characterName: 'claude', ready: true },
        { characterName: 'meta', ready: true },
        { characterName: 'gemini', ready: true },
        null,
      ],
    },
    seat: 2,
  });

  lobby.connection.onMessage('host-peer', {
    type: 'match-setup',
    setup: {
      seed: 9,
      levelName: 'cave',
      players: [
        { id: 'red', characterName: 'claude' },
        { id: 'blue', characterName: 'meta' },
        { id: 'green', characterName: 'gemini' },
      ],
    },
  });

  const match = lobby.sceneManager.currentScene;
  assert.ok(match instanceof OnlineMatchScene);
  assert.equal(match.isHost, false);
  assert.equal(match.session.localPlayerId, 'green');
  assert.deepEqual(match.session.playerIds, ['red', 'blue', 'green']);
  assert.equal(match.session.hostPlayerId, 'red');
  assert.equal(match.matchScene.level.name, 'cave');
});

test('a joiner is told when the host closes the room', () => {
  const lobby = startLobby({ isHost: false, connection: new FakeOnlineConnection({ peerIds: ['host-peer'] }) });

  lobby.connection.onPeerClose('host-peer');

  assert.equal(lobby.calls.hostLeft, 1);
  assert.equal(lobby.connection.closed, true);
});

test('a connection error while in the lobby is reported with its code', () => {
  const lobby = startLobby({ isHost: false });

  lobby.connection.onError({ code: 'connection-failed' });

  assert.deepEqual(lobby.calls.errors, ['connection-failed']);
});

test('Enter on the character row picks the next character', () => {
  const lobby = startLobby({ isHost: true });
  const startingName = lobby.scene.lobby.snapshot().seats[0].characterName;

  pressOnce(lobby.scene, { confirm: true });

  assert.notEqual(lobby.scene.lobby.snapshot().seats[0].characterName, startingName);
});

test('back takes a ready back first, then leaves the room', () => {
  const lobby = startLobby({ isHost: true });
  lobby.scene.selectedRow = ROW_READY;
  pressOnce(lobby.scene, { confirm: true });
  assert.equal(lobby.scene.lobby.seats[0].ready, true);

  pressOnce(lobby.scene, { back: true });
  assert.equal(lobby.scene.lobby.seats[0].ready, false);
  assert.equal(lobby.calls.left, 0);

  pressOnce(lobby.scene, { back: true });
  assert.equal(lobby.calls.left, 1);
});

test('any control on the device drives the one local player', () => {
  const lobby = startLobby({ isHost: true });

  lobby.scene.update({ red: idleInput(), blue: { ...idleInput(), down: true } });
  lobby.scene.update({ red: idleInput(), blue: idleInput() });

  assert.equal(lobby.scene.selectedRow, 1);
});

test('a control still held when the lobby opens does not count as a press', () => {
  const sceneManager = fakeSceneManager();
  const connection = new FakeOnlineConnection();
  const scene = new OnlineLobbyScene({
    sceneManager,
    connection,
    isHost: true,
    levels: LEVELS,
    sprites: {},
    seed: 1,
    onLeave() {},
    onHostLeft() {},
    onError() {},
  });

  scene.update({ red: { ...idleInput(), down: true }, blue: idleInput() });
  scene.update({ red: { ...idleInput(), down: true }, blue: idleInput() });

  assert.equal(scene.selectedRow, 0);
});
