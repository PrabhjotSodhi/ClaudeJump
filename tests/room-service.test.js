import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handleRoomRequest } from '../netlify/rooms/room-http.js';
import {
  CODE_ALPHABET,
  MAX_PAYLOAD_BYTES,
  MIN_POLL_INTERVAL_MILLISECONDS,
  ROOM_LIFETIME_MILLISECONDS,
  createRoomService,
} from '../netlify/rooms/room-service.js';

function createMemoryStore() {
  const entries = new Map();
  const versions = new Map();
  return {
    entries,
    get: async (key) => structuredClone(entries.get(key) ?? null),
    set: async (key, value) => void entries.set(key, structuredClone(value)),
    read: async (key) =>
      entries.has(key) ? { value: structuredClone(entries.get(key)), version: versions.get(key) } : null,
    write: async (key, value, version) => {
      if ((versions.get(key) ?? null) !== version) return false;
      entries.set(key, structuredClone(value));
      versions.set(key, (version ?? 0) + 1);
      return true;
    },
    delete: async (key) => void entries.delete(key),
    list: async (prefix) => [...entries.keys()].filter((key) => key.startsWith(prefix)),
  };
}

function createFixture() {
  const clock = { time: 1_000_000 };
  const store = createMemoryStore();
  const service = createRoomService({ store, now: () => clock.time });
  return { clock, store, service };
}

async function assertRejects(promise, code) {
  await assert.rejects(promise, (error) => error.code === code);
}

test('create makes a room with a 4 letter code without look-alike letters', async () => {
  const { service } = createFixture();
  for (let attempt = 0; attempt < 50; attempt++) {
    const { code, hostId } = await service.create();
    assert.equal(code.length, 4);
    assert.ok([...code].every((letter) => CODE_ALPHABET.includes(letter)));
    assert.ok(hostId);
  }
  assert.ok(!/[ILO01]/.test(CODE_ALPHABET));
});

test('join gives slots 1 to 3, then the room is full', async () => {
  const { service } = createFixture();
  const { code } = await service.create();
  const slots = [];
  for (let joiner = 0; joiner < 3; joiner++) {
    slots.push((await service.join({ code })).slot);
  }
  assert.deepEqual(slots, [1, 2, 3]);
  await assertRejects(service.join({ code }), 'room-full');
});

test('join accepts lower case codes and rejects unknown codes', async () => {
  const { service } = createFixture();
  const { code } = await service.create();
  assert.equal((await service.join({ code: code.toLowerCase() })).slot, 1);
  await assertRejects(service.join({ code: 'ZZZZ' }), 'room-not-found');
  await assertRejects(service.join({}), 'room-not-found');
});

test('a room expires after 10 minutes without activity and is cleaned up', async () => {
  const { clock, store, service } = createFixture();
  const { code } = await service.create();
  clock.time += ROOM_LIFETIME_MILLISECONDS - 1;
  const { playerId } = await service.join({ code });
  clock.time += ROOM_LIFETIME_MILLISECONDS - 1;
  await service.join({ code });
  clock.time += ROOM_LIFETIME_MILLISECONDS;
  await assertRejects(service.join({ code }), 'room-expired');
  await assertRejects(service.poll({ code, playerId }), 'room-not-found');
  assert.equal(store.entries.size, 0);
});

test('signals reach only the recipient, in order', async () => {
  const { clock, service } = createFixture();
  const { code, hostId } = await service.create();
  const first = await service.join({ code });
  const second = await service.join({ code });

  await service.signal({ code, from: hostId, to: first.playerId, payload: { type: 'offer', n: 1 } });
  clock.time += 1;
  await service.signal({ code, from: hostId, to: first.playerId, payload: { type: 'offer', n: 2 } });
  await service.signal({ code, from: hostId, to: second.playerId, payload: { type: 'offer', n: 3 } });

  const firstPoll = await service.poll({ code, playerId: first.playerId });
  assert.deepEqual(
    firstPoll.messages.map((message) => [message.from, message.payload.n]),
    [
      [hostId, 1],
      [hostId, 2],
    ],
  );
  const secondPoll = await service.poll({ code, playerId: second.playerId });
  assert.deepEqual(
    secondPoll.messages.map((message) => message.payload.n),
    [3],
  );
});

test('a message that sorts before one already delivered is still delivered', async () => {
  const { clock, service } = createFixture();
  const { code, hostId } = await service.create();
  const { playerId } = await service.join({ code });
  const send = (n) => service.signal({ code, from: hostId, to: playerId, payload: { n } });

  await send(1);
  const firstPoll = await service.poll({ code, playerId });
  clock.time -= 1;
  await send(2);
  clock.time += 1 + MIN_POLL_INTERVAL_MILLISECONDS;
  const laterPoll = await service.poll({ code, playerId, after: firstPoll.messages.at(-1).id });
  const delivered = laterPoll.messages.map((message) => message.payload.n);
  assert.ok(delivered.includes(2), `delivered ${delivered}`);
});

test('two players joining at the same moment get different slots', async () => {
  const { service } = createFixture();
  const { code } = await service.create();
  const joined = await Promise.all([service.join({ code }), service.join({ code })]);
  assert.deepEqual(joined.map((player) => player.slot).sort(), [1, 2]);
  await service.join({ code });
  await assertRejects(service.join({ code }), 'room-full');
});

test('many signals at once all succeed', async () => {
  const { service } = createFixture();
  const { code, hostId } = await service.create();
  const { playerId } = await service.join({ code });
  await Promise.all(
    Array.from({ length: 20 }, (_, n) =>
      service.signal({ code, from: hostId, to: playerId, payload: { type: 'candidate', n } }),
    ),
  );
  const { messages } = await service.poll({ code, playerId });
  assert.equal(messages.length, 20);
});

test('two hosts can never take the same code', async () => {
  const store = createMemoryStore();
  const service = createRoomService({ store, now: () => 1_000_000, random: () => 0 });
  await service.create();
  await assertRejects(service.create(), 'no-free-code');
});

test('payload size is measured in bytes, not characters', async () => {
  const { service } = createFixture();
  const { code, hostId } = await service.create();
  const { playerId } = await service.join({ code });
  const payload = { text: 'é'.repeat(MAX_PAYLOAD_BYTES / 2) };
  assert.ok(JSON.stringify(payload).length < MAX_PAYLOAD_BYTES);
  await assertRejects(service.signal({ code, from: hostId, to: playerId, payload }), 'payload-too-large');
});

test('the host is told when a player joins', async () => {
  const { service } = createFixture();
  const { code, hostId } = await service.create();
  const { playerId, slot } = await service.join({ code });
  const { messages } = await service.poll({ code, playerId: hostId });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].from, playerId);
  assert.deepEqual(messages[0].payload, { type: 'joined', slot });
});

test('signals from strangers, to strangers, or between joiners are rejected', async () => {
  const { service } = createFixture();
  const { code, hostId } = await service.create();
  const first = await service.join({ code });
  const second = await service.join({ code });
  const payload = { type: 'offer' };
  await assertRejects(service.signal({ code, from: 'nobody', to: hostId, payload }), 'unknown-player');
  await assertRejects(service.signal({ code, from: hostId, to: 'nobody', payload }), 'unknown-player');
  await assertRejects(service.signal({ code, from: first.playerId, to: second.playerId, payload }), 'bad-request');
  await assertRejects(service.poll({ code, playerId: 'nobody' }), 'unknown-player');
});

test('oversized payloads are rejected and nothing is stored', async () => {
  const { store, service } = createFixture();
  const { code, hostId } = await service.create();
  const { playerId } = await service.join({ code });
  const before = store.entries.size;
  const payload = { sdp: 'x'.repeat(MAX_PAYLOAD_BYTES) };
  await assertRejects(service.signal({ code, from: hostId, to: playerId, payload }), 'payload-too-large');
  assert.equal(store.entries.size, before);
  await service.signal({ code, from: hostId, to: playerId, payload: { sdp: 'x'.repeat(1000) } });
});

test('polling faster than the minimum interval is throttled per client', async () => {
  const { clock, service } = createFixture();
  const { code, hostId } = await service.create();
  const { playerId } = await service.join({ code });
  await service.poll({ code, playerId });
  clock.time += MIN_POLL_INTERVAL_MILLISECONDS - 1;
  await assertRejects(service.poll({ code, playerId }), 'too-many-requests');
  await service.poll({ code, playerId: hostId });
  clock.time += 1;
  await service.poll({ code, playerId });
});

test('the HTTP adapter routes requests and turns errors into statuses', async () => {
  const { service } = createFixture();
  const post = (action, body) =>
    handleRoomRequest(
      service,
      new Request(`http://localhost/api/rooms/${action}`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );

  const created = await (await post('create', {})).json();
  const joined = await post('join', { code: created.code });
  assert.equal(joined.status, 200);
  const { playerId } = await joined.json();

  const polled = await handleRoomRequest(
    service,
    new Request(`http://localhost/api/rooms/poll?code=${created.code}&playerId=${playerId}`),
  );
  assert.deepEqual(await polled.json(), { messages: [] });

  const unknown = await post('join', { code: 'ZZZZ' });
  assert.equal(unknown.status, 404);
  assert.deepEqual(await unknown.json(), { error: 'room-not-found' });
  assert.equal((await post('nothing', {})).status, 404);
  const badJson = await handleRoomRequest(
    service,
    new Request('http://localhost/api/rooms/join', { method: 'POST', body: 'not json' }),
  );
  assert.equal(badJson.status, 400);
});
