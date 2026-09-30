export const CODE_LENGTH = 4;
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const MAX_PLAYERS = 4;
export const ROOM_LIFETIME_MILLISECONDS = 10 * 60 * 1000;
export const MAX_PAYLOAD_BYTES = 8 * 1024;
export const MIN_POLL_INTERVAL_MILLISECONDS = 500;
const PLAYER_ID_LENGTH = 16;
const CODE_ATTEMPTS = 20;
const TIMESTAMP_DIGITS = 13;
const HEX_DIGITS = '0123456789abcdef';

export class RoomError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function randomInteger(maximumExclusive) {
  const [value] = crypto.getRandomValues(new Uint32Array(1));
  return value % maximumExclusive;
}

function randomText(alphabet, length, random) {
  let text = '';
  for (let index = 0; index < length; index++) {
    text += alphabet[random(alphabet.length)];
  }
  return text;
}

/**
 * Rooms and the messages between their players. `store` needs get(key),
 * set(key, value), delete(key) and list(prefix), which returns keys. `now`
 * returns milliseconds. Everything for a room lives under the key prefix
 * `CODE/`. Throws RoomError with a code and an HTTP status.
 */
export function createRoomService({ store, now = Date.now, random = randomInteger }) {
  const roomKey = (code) => `${code}/room`;
  const pollKey = (code, playerId) => `${code}/poll/${playerId}`;
  const mailboxPrefix = (code, playerId) => `${code}/message/${playerId}/`;
  const isExpired = (room) => now() - room.lastActivityAt >= ROOM_LIFETIME_MILLISECONDS;

  async function deleteRoom(code) {
    for (const key of await store.list(`${code}/`)) {
      await store.delete(key);
    }
  }

  async function loadRoom(codeInput) {
    const code = typeof codeInput === 'string' ? codeInput.toUpperCase() : '';
    const room = code ? await store.get(roomKey(code)) : null;
    if (!room) throw new RoomError('room-not-found', 404);
    if (isExpired(room)) {
      await deleteRoom(code);
      throw new RoomError('room-expired', 410);
    }
    return { code, room };
  }

  function findPlayer(room, playerId) {
    const player = room.players.find((candidate) => candidate.id === playerId);
    if (!player) throw new RoomError('unknown-player', 403);
    return player;
  }

  async function addMessage(code, toId, from, payload) {
    const timestamp = String(now()).padStart(TIMESTAMP_DIGITS, '0');
    const suffix = randomText(HEX_DIGITS, 6, random);
    await store.set(`${mailboxPrefix(code, toId)}${timestamp}-${suffix}`, { from, payload });
  }

  async function touch(code, room) {
    room.lastActivityAt = now();
    await store.set(roomKey(code), room);
  }

  async function create() {
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      const code = randomText(CODE_ALPHABET, CODE_LENGTH, random);
      const existing = await store.get(roomKey(code));
      if (existing && !isExpired(existing)) continue;
      if (existing) await deleteRoom(code);
      const hostId = randomText(HEX_DIGITS, PLAYER_ID_LENGTH, random);
      const timestamp = now();
      await store.set(roomKey(code), {
        createdAt: timestamp,
        lastActivityAt: timestamp,
        players: [{ id: hostId, slot: 0 }],
      });
      return { code, hostId };
    }
    throw new RoomError('no-free-code', 503);
  }

  async function join({ code: codeInput }) {
    const { code, room } = await loadRoom(codeInput);
    if (room.players.length >= MAX_PLAYERS) throw new RoomError('room-full', 409);
    const host = room.players[0];
    const playerId = randomText(HEX_DIGITS, PLAYER_ID_LENGTH, random);
    const slot = room.players.length;
    room.players.push({ id: playerId, slot });
    await touch(code, room);
    await addMessage(code, host.id, playerId, { type: 'joined', slot });
    return { playerId, hostId: host.id, slot };
  }

  async function signal({ code: codeInput, from, to, payload }) {
    const { code, room } = await loadRoom(codeInput);
    const sender = findPlayer(room, from);
    const recipient = findPlayer(room, to);
    const betweenTwoJoiners = sender.slot !== 0 && recipient.slot !== 0;
    if (sender === recipient || betweenTwoJoiners || payload === undefined) {
      throw new RoomError('bad-request', 400);
    }
    if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) {
      throw new RoomError('payload-too-large', 413);
    }
    await addMessage(code, to, from, payload);
    await touch(code, room);
    return {};
  }

  async function poll({ code: codeInput, playerId, after = '' }) {
    const { code, room } = await loadRoom(codeInput);
    findPlayer(room, playerId);
    const previousPoll = await store.get(pollKey(code, playerId));
    if (previousPoll && now() - previousPoll.at < MIN_POLL_INTERVAL_MILLISECONDS) {
      throw new RoomError('too-many-requests', 429);
    }
    await store.set(pollKey(code, playerId), { at: now() });
    const prefix = mailboxPrefix(code, playerId);
    const keys = (await store.list(prefix)).sort();
    const messages = [];
    for (const key of keys) {
      const id = key.slice(prefix.length);
      if (id <= after) continue;
      const message = await store.get(key);
      if (message) messages.push({ id, from: message.from, payload: message.payload });
    }
    return { messages };
  }

  return { create, join, signal, poll };
}
