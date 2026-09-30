export const CODE_LENGTH = 4;
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const MAX_PLAYERS = 4;
export const ROOM_LIFETIME_MILLISECONDS = 10 * 60 * 1000;
export const MAX_PAYLOAD_BYTES = 8 * 1024;
export const MIN_POLL_INTERVAL_MILLISECONDS = 500;
const PLAYER_ID_LENGTH = 16;
const CODE_ATTEMPTS = 20;
const ROOM_WRITE_ATTEMPTS = 5;
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

// Rooms and the messages between their players. `store` needs get(key),
// set(key, value), delete(key) and list(prefix), which returns keys, plus a
// conditional write for room records: read(key) returns { value, version } or
// null, and write(key, value, version) stores only if the key still has that
// version (null means the key must not exist yet) and returns whether it did.
// `now` returns milliseconds. Everything for a room lives under the key prefix
// `CODE/`. The room record only changes when someone joins; activity has its
// own key so that many signals at once never compete for the room record. Throws RoomError with a code and an HTTP status.
export function createRoomService({ store, now = Date.now, random = randomInteger }) {
  const roomKey = (code) => `${code}/room`;
  const pollKey = (code, playerId) => `${code}/poll/${playerId}`;
  const mailboxPrefix = (code, playerId) => `${code}/message/${playerId}/`;
  const activityKey = (code) => `${code}/activity`;

  async function isExpired(code, room) {
    const activity = await store.get(activityKey(code));
    const lastActivityAt = Math.max(room.createdAt, activity?.at ?? 0);
    return now() - lastActivityAt >= ROOM_LIFETIME_MILLISECONDS;
  }

  const touch = (code) => store.set(activityKey(code), { at: now() });

  async function deleteRoom(code) {
    for (const key of await store.list(`${code}/`)) {
      await store.delete(key);
    }
  }

  async function loadRoom(codeInput) {
    const code = typeof codeInput === 'string' ? codeInput.toUpperCase() : '';
    const stored = code ? await store.read(roomKey(code)) : null;
    if (!stored) throw new RoomError('room-not-found', 404);
    if (await isExpired(code, stored.value)) {
      await deleteRoom(code);
      throw new RoomError('room-expired', 410);
    }
    return { code, room: stored.value, version: stored.version };
  }

  // Runs `change(room)` on a fresh copy and saves it. Retries
  // when another request changed the room in between.
  async function updateRoom(codeInput, change) {
    for (let attempt = 0; attempt < ROOM_WRITE_ATTEMPTS; attempt++) {
      const { code, room, version } = await loadRoom(codeInput);
      const result = change(room);
      if (await store.write(roomKey(code), room, version)) return { code, room, result };
    }
    throw new RoomError('room-busy', 503);
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

  async function create() {
    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      const code = randomText(CODE_ALPHABET, CODE_LENGTH, random);
      const existing = await store.read(roomKey(code));
      if (existing && !(await isExpired(code, existing.value))) continue;
      if (existing) await deleteRoom(code);
      const hostId = randomText(HEX_DIGITS, PLAYER_ID_LENGTH, random);
      const timestamp = now();
      const room = {
        createdAt: timestamp,
        players: [{ id: hostId, slot: 0 }],
      };
      if (await store.write(roomKey(code), room, null)) {
        await touch(code);
        return { code, hostId };
      }
    }
    throw new RoomError('no-free-code', 503);
  }

  async function join({ code: codeInput }) {
    const playerId = randomText(HEX_DIGITS, PLAYER_ID_LENGTH, random);
    const { code, room, result } = await updateRoom(codeInput, (room) => {
      if (room.players.length >= MAX_PLAYERS) throw new RoomError('room-full', 409);
      const slot = room.players.length;
      room.players.push({ id: playerId, slot });
      return slot;
    });
    await touch(code);
    const hostId = room.players[0].id;
    await addMessage(code, hostId, playerId, { type: 'joined', slot: result });
    return { playerId, hostId, slot: result };
  }

  async function signal({ code: codeInput, from, to, payload }) {
    const { code, room } = await loadRoom(codeInput);
    const sender = findPlayer(room, from);
    const recipient = findPlayer(room, to);
    const betweenTwoJoiners = sender.slot !== 0 && recipient.slot !== 0;
    if (sender === recipient || betweenTwoJoiners || payload === undefined) {
      throw new RoomError('bad-request', 400);
    }
    if (new TextEncoder().encode(JSON.stringify(payload)).length > MAX_PAYLOAD_BYTES) {
      throw new RoomError('payload-too-large', 413);
    }
    await addMessage(code, to, from, payload);
    await touch(code);
    return {};
  }

  // Returns every message waiting for the player. Clients skip ids they have
  // already handled: messages written in the same millisecond have no reliable
  // order, so a cursor could skip one.
  async function poll({ code: codeInput, playerId }) {
    const { code, room } = await loadRoom(codeInput);
    findPlayer(room, playerId);
    const previousPoll = await store.get(pollKey(code, playerId));
    if (previousPoll && now() - previousPoll.at < MIN_POLL_INTERVAL_MILLISECONDS) {
      throw new RoomError('too-many-requests', 429);
    }
    await store.set(pollKey(code, playerId), { at: now() });
    const prefix = mailboxPrefix(code, playerId);
    const messages = [];
    for (const key of (await store.list(prefix)).sort()) {
      const message = await store.get(key);
      if (message) messages.push({ id: key.slice(prefix.length), from: message.from, payload: message.payload });
    }
    return { messages };
  }

  return { create, join, signal, poll };
}
