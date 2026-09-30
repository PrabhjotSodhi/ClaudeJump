import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHARACTERS } from '../src/entities/characters.js';
import { OnlineLobby, RANDOM_LEVEL } from '../src/scenes/online-lobby-state.js';

const LEVEL_NAMES = ['harbor', 'cave', 'bridge'];

function newLobby() {
  return new OnlineLobby({ levelNames: LEVEL_NAMES });
}

function lobbyWithReadyPlayers(memberIds) {
  const lobby = newLobby();
  for (const memberId of memberIds) {
    lobby.join(memberId);
    lobby.setReady(memberId, true);
  }
  return lobby;
}

test('members take seats in the order they join', () => {
  const lobby = newLobby();

  assert.equal(lobby.join('host'), 0);
  assert.equal(lobby.join('first'), 1);
  assert.equal(lobby.join('second'), 2);
  assert.equal(lobby.playerCount, 3);
});

test('joining twice keeps the same seat', () => {
  const lobby = newLobby();
  lobby.join('host');
  lobby.join('first');

  assert.equal(lobby.join('first'), 1);
  assert.equal(lobby.playerCount, 2);
});

test('a fifth member is turned away', () => {
  const lobby = newLobby();
  for (const memberId of ['a', 'b', 'c', 'd']) lobby.join(memberId);

  assert.equal(lobby.join('e'), -1);
  assert.equal(lobby.playerCount, 4);
});

test('a seat that frees up is given to the next member and other seats stay put', () => {
  const lobby = newLobby();
  for (const memberId of ['host', 'first', 'second']) lobby.join(memberId);

  lobby.leave('first');

  assert.equal(lobby.seatOf('second'), 2);
  assert.equal(lobby.join('third'), 1);
});

test('leaving a room you are not in changes nothing', () => {
  const lobby = newLobby();
  lobby.join('host');

  assert.equal(lobby.leave('stranger'), false);
  assert.equal(lobby.playerCount, 1);
});

test('every seat starts on a different character', () => {
  const lobby = newLobby();
  for (const memberId of ['a', 'b', 'c', 'd']) lobby.join(memberId);

  const names = lobby.snapshot().seats.map((seat) => seat.characterName);

  assert.equal(new Set(names).size, 4);
});

test('a character picked by another player is skipped', () => {
  const lobby = newLobby();
  lobby.join('host');
  lobby.join('guest');
  const [hostBefore, guestBefore] = lobby
    .snapshot()
    .seats.slice(0, 2)
    .map((seat) => seat.characterName);
  const nextCharacterName =
    CHARACTERS[(CHARACTERS.findIndex((c) => c.name === hostBefore) + 1) % CHARACTERS.length].name;
  assert.equal(nextCharacterName, guestBefore);

  lobby.changeCharacter('host', 1);

  const hostAfter = lobby.snapshot().seats[0].characterName;
  assert.notEqual(hostAfter, hostBefore);
  assert.notEqual(hostAfter, guestBefore);
});

test('picking left and then right returns to the same character', () => {
  const lobby = newLobby();
  lobby.join('host');
  const before = lobby.snapshot().seats[0].characterName;

  lobby.changeCharacter('host', -1);
  lobby.changeCharacter('host', 1);

  assert.equal(lobby.snapshot().seats[0].characterName, before);
});

test('a ready player cannot change character until they un-ready', () => {
  const lobby = newLobby();
  lobby.join('host');
  const before = lobby.snapshot().seats[0].characterName;
  lobby.setReady('host', true);

  assert.equal(lobby.changeCharacter('host', 1), false);
  assert.equal(lobby.snapshot().seats[0].characterName, before);

  lobby.setReady('host', false);
  assert.equal(lobby.changeCharacter('host', 1), true);
});

test('toggling ready flips the ready state', () => {
  const lobby = newLobby();
  lobby.join('host');

  lobby.toggleReady('host');
  assert.equal(lobby.snapshot().seats[0].ready, true);
  lobby.toggleReady('host');
  assert.equal(lobby.snapshot().seats[0].ready, false);
});

test('one ready player alone cannot start', () => {
  assert.equal(lobbyWithReadyPlayers(['host']).canStart(), false);
});

test('two ready players can start', () => {
  assert.equal(lobbyWithReadyPlayers(['host', 'guest']).canStart(), true);
});

test('a player who is not ready holds the match back', () => {
  const lobby = lobbyWithReadyPlayers(['host', 'first']);
  lobby.join('second');

  assert.equal(lobby.canStart(), false);

  lobby.setReady('second', true);
  assert.equal(lobby.canStart(), true);
});

test('a player who leaves no longer holds the match back', () => {
  const lobby = lobbyWithReadyPlayers(['host', 'first']);
  lobby.join('second');

  lobby.leave('second');

  assert.equal(lobby.canStart(), true);
});

test('the level picker cycles through every level and Random, in both directions', () => {
  const lobby = newLobby();
  assert.equal(lobby.levelName, RANDOM_LEVEL);

  const seen = [];
  for (let step = 0; step < 4; step++) {
    lobby.changeLevel(1);
    seen.push(lobby.levelName);
  }
  assert.deepEqual(seen, ['harbor', 'cave', 'bridge', RANDOM_LEVEL]);

  lobby.changeLevel(-1);
  assert.equal(lobby.levelName, 'bridge');
});

test('the match setup lists the seated players in seat order with their characters', () => {
  const lobby = lobbyWithReadyPlayers(['host', 'first', 'second']);
  lobby.leave('first');
  lobby.changeLevel(1);
  lobby.setReady('second', false);
  lobby.changeCharacter('second', 1);
  lobby.setReady('second', true);
  const { characterName } = lobby.snapshot().seats[2];

  const setup = lobby.matchSetup(77);

  assert.equal(setup.seed, 77);
  assert.equal(setup.levelName, 'harbor');
  assert.deepEqual(
    setup.players.map((player) => player.id),
    ['red', 'green'],
  );
  assert.equal(setup.players[1].characterName, characterName);
});

test('Random picks a real level from the seed, the same one every time', () => {
  const lobby = lobbyWithReadyPlayers(['host', 'guest']);

  const picks = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const { levelName } = lobby.matchSetup(seed);
    assert.ok(LEVEL_NAMES.includes(levelName));
    assert.equal(lobby.matchSetup(seed).levelName, levelName);
    picks.add(levelName);
  }
  assert.equal(picks.size, LEVEL_NAMES.length);
});

test('a snapshot carries seats, characters, ready flags and the level, and nothing private', () => {
  const lobby = lobbyWithReadyPlayers(['host-peer', 'guest-peer']);
  lobby.changeLevel(1);

  const snapshot = lobby.snapshot();

  assert.equal(JSON.stringify(snapshot).includes('peer'), false);
  assert.equal(snapshot.levelName, 'harbor');
  assert.deepEqual(
    snapshot.seats.map((seat) => seat?.ready ?? null),
    [true, true, null, null],
  );
});

test('a joiner that loads the snapshot sees the same lobby', () => {
  const host = lobbyWithReadyPlayers(['host', 'guest']);
  host.changeLevel(-1);
  host.setReady('guest', false);
  host.changeCharacter('host', 1);
  const copy = newLobby();

  copy.load(JSON.parse(JSON.stringify(host.snapshot())));

  assert.deepEqual(copy.snapshot(), host.snapshot());
  assert.equal(copy.canStart(), host.canStart());
});

test('a snapshot with nonsense in it is cleaned up instead of trusted', () => {
  const lobby = newLobby();

  lobby.load({ levelName: 'nowhere', seats: [{ characterName: 'nobody', ready: 'yes' }, null, null, null, null] });

  assert.equal(lobby.levelName, RANDOM_LEVEL);
  assert.equal(lobby.playerCount, 0);
});

test('a rematch keeps everyone in their seat with their character and ready flag', () => {
  const lobby = lobbyWithReadyPlayers(['host', 'guest']);
  const before = lobby.snapshot();

  const afterRematch = newLobby();
  afterRematch.load(lobby.snapshot());

  assert.deepEqual(afterRematch.snapshot(), before);
  assert.equal(afterRematch.matchSetup(1).players.length, 2);
  assert.notEqual(lobby.matchSetup(1).seed, lobby.matchSetup(2).seed);
});
