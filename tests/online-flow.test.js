import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeLocalInputs } from '../src/engine/input.js';
import { describeOnlineError, openOnlineMenu } from '../src/scenes/online-flow.js';
import { OnlineJoinScene, joinLayout } from '../src/scenes/online-join-scene.js';
import { OnlineLobbyScene } from '../src/scenes/online-lobby-scene.js';
import { OnlineMenuScene } from '../src/scenes/online-menu-scene.js';
import { GRID_ITEMS } from '../src/scenes/room-code-entry.js';
import { TitleScene } from '../src/scenes/title-scene.js';
import { harborLevel } from './fixtures/harbor-level.mjs';
import { FakeOnlineConnection, fakeSceneManager, idleInput, pressOnce } from './fixtures/fake-online-connection.mjs';

const ERROR_CODES = ['no-webrtc', 'room-not-found', 'room-expired', 'room-full', 'connection-failed', 'server-error'];

class FakeOnlineError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

// Open the online menu with a fake connection module. `hostRoom` and `joinRoom` are what the module offers.
function openMenu({ hostRoom, joinRoom } = {}) {
  const sceneManager = fakeSceneManager();
  const titleReturns = [];
  const module = { hostRoom, joinRoom };
  let loads = 0;
  openOnlineMenu({
    sceneManager,
    levels: [harborLevel],
    sprites: {},
    seed: 1,
    returnToTitle: () => titleReturns.push(true),
    loadConnection: () => {
      loads++;
      return Promise.resolve(module);
    },
  });
  sceneManager.currentScene.update({ red: idleInput() });
  return { sceneManager, titleReturns, loads: () => loads };
}

function choose(scene, label) {
  const index = scene.options.findIndex((option) => option.label === label);
  scene.selectedIndex = index;
  scene.update({ red: idleInput() });
  pressOnce(scene, { confirm: true });
}

function typeCode(scene, code) {
  for (const letter of code) pressItem(scene, GRID_ITEMS.indexOf(letter));
}

function pressItem(scene, itemIndex) {
  scene.entry.cursorIndex = itemIndex;
  pressOnce(scene, { jump: true });
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('every online error has its own clear message', () => {
  const titles = ERROR_CODES.map((code) => describeOnlineError(code)[0]);

  assert.equal(new Set(titles).size, ERROR_CODES.length);
  assert.deepEqual(describeOnlineError('room-full'), ['That room is full', 'A room holds up to four players']);
  assert.deepEqual(describeOnlineError('something new'), describeOnlineError('server-error'));
});

test('the online menu offers Host, Join and Back and loads the connection once', () => {
  const { sceneManager, loads } = openMenu();

  const scene = sceneManager.currentScene;
  assert.ok(scene instanceof OnlineMenuScene);
  assert.deepEqual(
    scene.options.map((option) => option.label),
    ['Host', 'Join', 'Back'],
  );
  assert.equal(loads(), 1);
});

test('Back on the online menu returns to the title', () => {
  const { sceneManager, titleReturns } = openMenu();

  choose(sceneManager.currentScene, 'Back');

  assert.equal(titleReturns.length, 1);
});

test('the title lists Online after Versus and Survival, then Settings', () => {
  const scene = new TitleScene({ sceneManager: fakeSceneManager(), levels: [harborLevel], sprites: {} });

  assert.deepEqual(
    scene.options.map((option) => option.label),
    ['Versus', 'Survival', 'Online', 'Settings'],
  );
});

test('choosing Online on the title opens the online menu', () => {
  const sceneManager = fakeSceneManager();
  const scene = new TitleScene({ sceneManager, levels: [harborLevel], sprites: {} });
  scene.update({ red: idleInput() });
  scene.selectedIndex = 2;

  assert.equal(sceneManager.currentScene, null);
  pressOnce(scene, { confirm: true });

  assert.ok(sceneManager.currentScene instanceof OnlineMenuScene);
  assert.equal(sceneManager.currentScene.title, 'Online');
});

test('hosting shows the room code in a lobby with the host seated', async () => {
  const connection = new FakeOnlineConnection({ code: 'QRST' });
  const { sceneManager } = openMenu({ hostRoom: async () => connection });

  choose(sceneManager.currentScene, 'Host');
  assert.equal(sceneManager.currentScene.title, 'Creating room');
  await settle();

  const lobby = sceneManager.currentScene;
  assert.ok(lobby instanceof OnlineLobbyScene);
  assert.equal(lobby.isHost, true);
  assert.equal(lobby.code, 'QRST');
  assert.equal(lobby.lobby.playerCount, 1);
});

test('a host error shows a message with Try again and Back', async () => {
  const { sceneManager } = openMenu({
    hostRoom: async () => {
      throw new FakeOnlineError('server-error');
    },
  });

  choose(sceneManager.currentScene, 'Host');
  await settle();

  const notice = sceneManager.currentScene;
  assert.equal(notice.title, 'Cannot reach the server');
  assert.deepEqual(
    notice.options.map((option) => option.label),
    ['Try again', 'Back'],
  );
  choose(notice, 'Back');
  assert.equal(sceneManager.currentScene.title, 'Online');
});

test('a room that opens after the player backed out is closed again', async () => {
  const connection = new FakeOnlineConnection();
  let finish;
  const { sceneManager } = openMenu({ hostRoom: () => new Promise((resolve) => (finish = resolve)) });
  choose(sceneManager.currentScene, 'Host');
  await settle();

  choose(sceneManager.currentScene, 'Back');
  finish(connection);
  await settle();

  assert.equal(connection.closed, true);
  assert.equal(sceneManager.currentScene.title, 'Online');
});

test('typing a code letter by letter joins that room and shows the lobby', async () => {
  const connection = new FakeOnlineConnection({ code: 'KQZP' });
  const joined = [];
  const { sceneManager } = openMenu({
    joinRoom: async (code) => {
      joined.push(code);
      return connection;
    },
  });
  choose(sceneManager.currentScene, 'Join');
  const joinScene = sceneManager.currentScene;
  assert.ok(joinScene instanceof OnlineJoinScene);
  joinScene.update({ red: idleInput() });

  typeCode(joinScene, 'KQZP');
  assert.deepEqual(joined, []);
  pressItem(joinScene, GRID_ITEMS.indexOf('join'));
  await settle();

  assert.deepEqual(joined, ['KQZP']);
  const lobby = sceneManager.currentScene;
  assert.ok(lobby instanceof OnlineLobbyScene);
  assert.equal(lobby.isHost, false);
});

test('a code can be typed with the keys too', async () => {
  const joined = [];
  const { sceneManager } = openMenu({
    joinRoom: async (code) => {
      joined.push(code);
      return new FakeOnlineConnection();
    },
  });
  choose(sceneManager.currentScene, 'Join');
  const joinScene = sceneManager.currentScene;
  joinScene.update({ red: idleInput() });

  pressOnce(joinScene, { confirm: true });
  pressOnce(joinScene, { right: true });
  pressOnce(joinScene, { confirm: true });
  pressOnce(joinScene, { down: true });
  pressOnce(joinScene, { confirm: true });
  pressOnce(joinScene, { left: true });
  pressOnce(joinScene, { confirm: true });
  assert.equal(joinScene.entry.code, 'ABMK');
  pressOnce(joinScene, { confirm: true });
  await settle();

  assert.deepEqual(joined, ['ABMK']);
});

for (const [code, title] of [
  ['room-not-found', 'No room found'],
  ['room-full', 'That room is full'],
  ['connection-failed', 'Could not connect'],
]) {
  test(`joining fails with ${code}: the message shows and the player can go back or try another code`, async () => {
    const { sceneManager } = openMenu({
      joinRoom: async () => {
        throw new FakeOnlineError(code);
      },
    });
    choose(sceneManager.currentScene, 'Join');
    const joinScene = sceneManager.currentScene;
    joinScene.update({ red: idleInput() });
    typeCode(joinScene, 'ABCD');
    pressItem(joinScene, GRID_ITEMS.indexOf('join'));
    await settle();

    const notice = sceneManager.currentScene;
    assert.equal(notice.title, title);
    assert.deepEqual(
      notice.options.map((option) => option.label),
      ['Try another code', 'Back'],
    );
    choose(notice, 'Try another code');
    assert.ok(sceneManager.currentScene instanceof OnlineJoinScene);
    assert.equal(sceneManager.currentScene.entry.code, '');
  });
}

test('a failed connection module load reads as a server problem', async () => {
  const sceneManager = fakeSceneManager();
  openOnlineMenu({
    sceneManager,
    levels: [harborLevel],
    sprites: {},
    seed: 1,
    returnToTitle() {},
    loadConnection: () => Promise.reject(new Error('offline')),
  });
  sceneManager.currentScene.update({ red: idleInput() });

  choose(sceneManager.currentScene, 'Host');
  await settle();

  assert.equal(sceneManager.currentScene.title, 'Cannot reach the server');
});

test('the host leaving shows a message with a way back', async () => {
  const connection = new FakeOnlineConnection({ peerIds: ['host-peer'] });
  const { sceneManager, titleReturns } = openMenu({ joinRoom: async () => connection });
  choose(sceneManager.currentScene, 'Join');
  sceneManager.currentScene.update({ red: idleInput() });
  typeCode(sceneManager.currentScene, 'ABCD');
  pressItem(sceneManager.currentScene, GRID_ITEMS.indexOf('join'));
  await settle();

  connection.onPeerClose('host-peer');

  const notice = sceneManager.currentScene;
  assert.equal(notice.title, 'The host left');
  notice.update({ red: idleInput() });
  choose(notice, 'Back');
  assert.equal(titleReturns.length, 1);
});

test('a connection error in the lobby shows its message with a way back', async () => {
  const connection = new FakeOnlineConnection();
  const { sceneManager, titleReturns } = openMenu({ hostRoom: async () => connection });
  choose(sceneManager.currentScene, 'Host');
  await settle();

  connection.onError({ code: 'connection-failed' });

  const notice = sceneManager.currentScene;
  assert.equal(notice.title, 'Could not connect');
  choose(notice, 'Back');
  assert.equal(titleReturns.length, 1);
});

test('the code screen only joins with four letters and Back leaves', () => {
  const joins = [];
  let backs = 0;
  const scene = new OnlineJoinScene({ onJoin: (code) => joins.push(code), onBack: () => backs++ });
  scene.update({ red: idleInput() });

  typeCode(scene, 'AB');
  pressItem(scene, GRID_ITEMS.indexOf('join'));
  assert.deepEqual(joins, []);

  pressItem(scene, GRID_ITEMS.indexOf('delete'));
  assert.equal(scene.entry.code, 'A');
  pressItem(scene, GRID_ITEMS.indexOf('back'));
  assert.equal(backs, 1);
});

test('every letter tile is inside the screen and no two tiles overlap', () => {
  const { tiles } = joinLayout();

  for (const tile of tiles) {
    assert.ok(tile.x >= 0 && tile.x + tile.width <= 640 && tile.y >= 0 && tile.y + tile.height <= 360);
  }
  for (const [index, tile] of tiles.entries()) {
    for (const other of tiles.slice(index + 1)) {
      const apart =
        tile.x + tile.width <= other.x ||
        other.x + other.width <= tile.x ||
        tile.y + tile.height <= other.y ||
        other.y + other.height <= tile.y;
      assert.ok(apart);
    }
  }
});

test('one device merges both keyboard sides, pad 1 and touch into one input', () => {
  const merged = mergeLocalInputs({
    red: { ...idleInput(), left: true },
    blue: { ...idleInput(), jump: true },
  });

  assert.equal(merged.left, true);
  assert.equal(merged.jump, true);
  assert.equal(merged.right, false);
  assert.equal(mergeLocalInputs({}).left, false);
});
