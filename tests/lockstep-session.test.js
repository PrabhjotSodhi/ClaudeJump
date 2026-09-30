import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INPUT_DELAY_TICKS, STALL_TIMEOUT_TICKS } from '../src/engine/config.js';
import { LockstepSession } from '../src/engine/lockstep-session.js';
import { SeededRandom } from '../src/engine/seeded-random.js';
import { stateHash } from '../src/engine/state-hash.js';
import { CHARACTERS } from '../src/entities/characters.js';
import { PLAYERS } from '../src/levels/versus-arena.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { harborLevel } from './fixtures/harbor-level.mjs';
import { SimulatedNetwork } from './fixtures/simulated-network.mjs';

const MATCH_SEED = 7;
const HOST_ID = 'red';
const IDLE = { left: false, right: false, jump: false, up: false, down: false, action: false };

function startMatch({ playerCount, networkSeed = 1, maxDelaySteps = 3, shapeMessage }) {
  const players = PLAYERS.slice(0, playerCount).map(({ id }, index) => ({ id, character: CHARACTERS[index] }));
  const playerIds = players.map(({ id }) => id);
  const joinerIds = playerIds.filter((id) => id !== HOST_ID);
  const network = new SimulatedNetwork({ seed: networkSeed, maxDelaySteps, shapeMessage });

  const peers = playerIds.map((id, index) => {
    const isHost = id === HOST_ID;
    const transport = network.addTransport(id, isHost ? joinerIds : [HOST_ID]);
    const session = new LockstepSession({
      transport,
      isHost,
      localPlayerId: id,
      playerIds,
      playerIdByPeerId: Object.fromEntries(joinerIds.map((joinerId) => [joinerId, joinerId])),
      hostPlayerId: HOST_ID,
    });
    const random = new SeededRandom(1000 + index);
    return {
      id,
      session,
      transport,
      scene: new VersusScene({ level: harborLevel, seed: MATCH_SEED, players, startInFightPhase: true }),
      sampledAtTick: [],
      setsByTick: [],
      hashes: [],
      sample() {
        this.sampledAtTick[session.currentTick] = {
          left: random.next() < 0.4,
          right: random.next() < 0.4,
          jump: random.next() < 0.1,
          up: false,
          down: false,
          action: random.next() < 0.05,
        };
        return this.sampledAtTick[session.currentTick];
      },
    };
  });
  return { players, playerIds, network, peers };
}

function stepPeer(peer, scene = peer.scene) {
  const tick = peer.session.currentTick;
  const inputs = peer.session.advance(() => peer.sample());
  if (!inputs) return;
  peer.setsByTick[tick] = inputs;
  scene.update(inputs);
  peer.session.completeTick(() => {
    const hash = stateHash(scene);
    peer.hashes.push(hash);
    return hash;
  });
}

// One step is one attempted tick on every device, and the network moves on by one step.
function run({ network, peers }, { steps, untilTick = Infinity }) {
  for (let step = 0; step < steps; step++) {
    network.advance();
    for (const peer of peers) if (peer.session.currentTick < untilTick) stepPeer(peer);
    if (peers.every((peer) => peer.session.currentTick >= untilTick)) return;
  }
}

for (const playerCount of [2, 3, 4]) {
  test(`${playerCount} peers with random delay and reordering finish a match with identical hashes`, () => {
    const totalTicks = 400;
    for (const networkSeed of [1, 2, 3]) {
      const match = startMatch({ playerCount, networkSeed, maxDelaySteps: 6 });
      run(match, { steps: 5000, untilTick: totalTicks });

      const [host, ...joiners] = match.peers;
      for (const peer of match.peers) {
        assert.equal(peer.session.status, 'running');
        assert.equal(peer.session.currentTick, totalTicks);
        assert.equal(peer.hashes.length, Math.floor(totalTicks / 60));
      }
      for (const joiner of joiners) {
        assert.deepEqual(joiner.setsByTick, host.setsByTick);
        assert.deepEqual(joiner.hashes, host.hashes);
        assert.equal(stateHash(joiner.scene), stateHash(host.scene));
      }
    }
  });
}

test('every press lands on every device exactly the input delay after it was sampled', () => {
  const match = startMatch({ playerCount: 3, maxDelaySteps: 6 });
  run(match, { steps: 3000, untilTick: 200 });

  for (const peer of match.peers) {
    for (let tick = 0; tick < 200; tick++) {
      for (const owner of match.peers) {
        const expected = tick < INPUT_DELAY_TICKS ? IDLE : owner.sampledAtTick[tick - INPUT_DELAY_TICKS];
        assert.deepEqual(peer.setsByTick[tick][owner.id], expected, `${owner.id} at tick ${tick} seen by ${peer.id}`);
      }
    }
  }
});

test('a tick never runs before the full set of inputs is in', () => {
  const match = startMatch({ playerCount: 3, maxDelaySteps: 6 });
  const [host, ...joiners] = match.peers;
  const inputCountsByTick = new Map();
  const collectInput = host.session.collectInput.bind(host.session);
  host.session.collectInput = (playerId, tick, input) => {
    inputCountsByTick.set(tick, new Set([...(inputCountsByTick.get(tick) ?? []), playerId]));
    collectInput(playerId, tick, input);
  };
  for (let step = 0; step < 400; step++) {
    match.network.advance();
    for (const peer of match.peers) {
      const tick = peer.session.currentTick;
      stepPeer(peer);
      if (peer.session.currentTick > tick && tick >= INPUT_DELAY_TICKS) {
        assert.equal(inputCountsByTick.get(tick)?.size, match.playerIds.length, `${peer.id} ran tick ${tick}`);
      }
    }
  }
  assert.ok(joiners.every((joiner) => joiner.session.currentTick > 0));
});

test('an input that arrives late stalls the tick and the match carries on in step', () => {
  const lateFrom = 'blue';
  const match = startMatch({
    playerCount: 3,
    shapeMessage: ({ from, data }) => (from === lateFrom && data.type === 'input' && data.tick === 50 ? 80 : 0),
  });
  const [host, ...joiners] = match.peers;

  run(match, { steps: 70, untilTick: 500 });
  for (const peer of match.peers) assert.equal(peer.session.currentTick, 50);

  run(match, { steps: 3000, untilTick: 500 });
  for (const peer of match.peers) assert.equal(peer.session.currentTick, 500);
  for (const joiner of joiners) {
    assert.deepEqual(joiner.hashes, host.hashes);
    assert.equal(stateHash(joiner.scene), stateHash(host.scene));
  }
});

test('a dropped input stalls every device at that tick without a desync, then reports the missing player', () => {
  const match = startMatch({
    playerCount: 3,
    shapeMessage: ({ from, data }) => (from === 'blue' && data.type === 'input' && data.tick === 50 ? 'drop' : 0),
  });
  const stallSteps = 200;

  run(match, { steps: stallSteps, untilTick: 500 });
  for (const peer of match.peers) {
    assert.equal(peer.session.currentTick, 50);
    assert.equal(peer.session.status, 'running');
  }

  run(match, { steps: STALL_TIMEOUT_TICKS + 100, untilTick: 500 });
  const host = match.peers[0];
  assert.equal(host.session.status, 'disconnected');
  assert.equal(host.session.disconnectedPlayerId, 'blue');
  for (const peer of match.peers) {
    assert.equal(peer.session.status, 'disconnected');
    assert.equal(peer.session.disconnectedPlayerId, 'blue');
    assert.equal(peer.session.currentTick, 50);
  }
});

test('a state that drifts on one device is caught at the next hash check and ends the match for everyone', () => {
  const match = startMatch({ playerCount: 3 });
  run(match, { steps: 1000, untilTick: 90 });
  for (const peer of match.peers) assert.equal(peer.session.status, 'running');

  const joiner = match.peers[2];
  joiner.scene.players[0].x += 1;
  run(match, { steps: 1000, untilTick: 200 });

  for (const peer of match.peers) {
    assert.equal(peer.session.status, 'desynced');
    assert.equal(peer.session.desyncTick, 120);
    assert.ok(peer.session.currentTick < 200);
  }
});

test('a joiner that leaves is reported to everyone else by the host', () => {
  const match = startMatch({ playerCount: 3 });
  run(match, { steps: 500, untilTick: 100 });
  match.peers[2].transport.close();
  run(match, { steps: 50, untilTick: 300 });

  for (const peer of match.peers.slice(0, 2)) {
    assert.equal(peer.session.status, 'disconnected');
    assert.equal(peer.session.disconnectedPlayerId, 'green');
  }
});

test('joiners see the host leave', () => {
  const match = startMatch({ playerCount: 3 });
  run(match, { steps: 500, untilTick: 100 });
  match.peers[0].transport.close();
  run(match, { steps: 50, untilTick: 300 });

  for (const peer of match.peers.slice(1)) {
    assert.equal(peer.session.status, 'disconnected');
    assert.equal(peer.session.disconnectedPlayerId, HOST_ID);
  }
});

test('inputs from an unknown peer or for a past tick are ignored', () => {
  const match = startMatch({ playerCount: 2 });
  const [host] = match.peers;
  run(match, { steps: 500, untilTick: 100 });
  const setsBefore = structuredClone(host.setsByTick);

  host.transport.onMessage('stranger', { type: 'input', tick: 105, input: { jump: true } });
  host.transport.onMessage('blue', { type: 'input', tick: 3, input: { jump: true } });
  run(match, { steps: 500, untilTick: 200 });

  assert.deepEqual(host.setsByTick.slice(0, 100), setsBefore);
  assert.equal(host.session.status, 'running');
  const [, blue] = match.peers;
  for (let tick = INPUT_DELAY_TICKS; tick < 200; tick++) {
    assert.deepEqual(host.setsByTick[tick].blue, blue.sampledAtTick[tick - INPUT_DELAY_TICKS]);
  }
});
