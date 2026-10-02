import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LockstepSession } from '../src/engine/lockstep-session.js';
import { SeededRandom } from '../src/engine/seeded-random.js';
import { stateHash } from '../src/engine/state-hash.js';
import { CHARACTERS } from '../src/entities/characters.js';
import { PLAYERS } from '../src/levels/versus-arena.js';
import { MATCH_MODES } from '../src/scenes/match-modes.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { arenaLevels } from './fixtures/arena-levels.mjs';
import { SimulatedNetwork } from './fixtures/simulated-network.mjs';

const HOST_ID = 'red';
const MAX_STEPS = 80000;

// Every device builds its own scene from the same setup, as the online lobby does, and plays from the
// countdown on, so round intros, modifier picks, crates and the mode's own rules all run in lockstep.
function playOnlineMatch({ mode, levelName, playerCount, seed }) {
  const players = PLAYERS.slice(0, playerCount).map(({ id }, index) => ({ id, character: CHARACTERS[index] }));
  const playerIds = players.map(({ id }) => id);
  const joinerIds = playerIds.filter((id) => id !== HOST_ID);
  const network = new SimulatedNetwork({ seed, maxDelaySteps: 4 });
  const peers = playerIds.map((id, index) => {
    const random = new SeededRandom(seed * 10 + index);
    // Runs one way, the other way or stands still for a random stretch, so players cross the arena and fall in.
    let direction = 0;
    let ticksUntilTurn = 0;
    return {
      session: new LockstepSession({
        transport: network.addTransport(id, id === HOST_ID ? joinerIds : [HOST_ID]),
        isHost: id === HOST_ID,
        localPlayerId: id,
        playerIds,
        playerIdByPeerId: Object.fromEntries(joinerIds.map((joinerId) => [joinerId, joinerId])),
        hostPlayerId: HOST_ID,
      }),
      scene: new VersusScene({ level: arenaLevels[levelName], seed, players, mode }),
      hashes: [],
      sample: () => {
        ticksUntilTurn--;
        if (ticksUntilTurn <= 0) {
          direction = Math.floor(random.next() * 3) - 1;
          ticksUntilTurn = 20 + Math.floor(random.next() * 60);
        }
        return {
          left: direction < 0,
          right: direction > 0,
          jump: random.next() < 0.15,
          up: random.next() < 0.05,
          down: random.next() < 0.05,
          action: random.next() < 0.05,
        };
      },
    };
  });

  const matchOver = (peer) => peer.scene.phase === 'match';
  for (let step = 0; step < MAX_STEPS && !peers.every(matchOver); step++) {
    network.advance();
    for (const peer of peers) {
      if (matchOver(peer)) continue;
      const inputs = peer.session.advance(peer.sample);
      if (!inputs) continue;
      peer.scene.update(inputs);
      peer.session.completeTick(() => {
        const hash = stateHash(peer.scene);
        peer.hashes.push(hash);
        return hash;
      });
    }
  }
  return peers;
}

const levelNames = Object.keys(arenaLevels);

MATCH_MODES.forEach(({ id: mode }, modeIndex) => {
  for (const playerCount of [2, 3, 4]) {
    const levelName = levelNames[(modeIndex * 3 + playerCount) % levelNames.length];
    test(`${playerCount} online peers play a whole ${mode} match on ${levelName} to the same state`, () => {
      const [host, ...joiners] = playOnlineMatch({ mode, levelName, playerCount, seed: modeIndex * 10 + playerCount });
      for (const peer of [host, ...joiners]) {
        assert.equal(peer.session.status, 'running');
        assert.equal(peer.scene.phase, 'match');
      }
      assert.ok(host.scene.winnerId);
      for (const joiner of joiners) {
        assert.equal(joiner.scene.winnerId, host.scene.winnerId);
        assert.deepEqual(joiner.scene.wins, host.scene.wins);
        assert.deepEqual(joiner.hashes, host.hashes);
        assert.equal(stateHash(joiner.scene), stateHash(host.scene));
      }
    });
  }
});
