import { HASH_INTERVAL_TICKS, INPUT_DELAY_TICKS, STALL_TIMEOUT_TICKS } from './config.js';

const CONTROL_NAMES = ['left', 'right', 'jump', 'up', 'down', 'action'];

// Only these controls cross the network, always as plain booleans, so every device applies identical records.
function cleanInput(input) {
  const record = {};
  for (const controlName of CONTROL_NAMES) record[controlName] = input?.[controlName] === true;
  return record;
}

// Input delay lockstep over a star network. Every device runs the same ticks with the same full set of
// inputs, so the scene needs no networking code and could later be rolled back.
//
// Each tick the driver calls `advance(sampleLocalInput)`. It returns the input record of every player for
// that tick, or null while inputs are still missing, in which case the driver just tries again next tick.
// After running the scene with the returned inputs, call `completeTick(computeHash)`.
//
// A joiner sends its own input to the host. The host collects every player's input for a tick and
// broadcasts the full set. Every `hashIntervalTicks` the joiners send their state hash and the host
// compares them with its own. `status` becomes 'desynced' or 'disconnected' and stays there.
//
// `transport` has send(peerId, data), broadcast(data) and settable onMessage(peerId, data) and
// onPeerClose(peerId), like OnlineConnection. The host passes `playerIdByPeerId` for its joiners.
// A joiner passes `hostPlayerId`, the player on the other end.
export class LockstepSession {
  constructor({
    transport,
    isHost,
    localPlayerId,
    playerIds,
    playerIdByPeerId = {},
    hostPlayerId = localPlayerId,
    inputDelayTicks = INPUT_DELAY_TICKS,
    hashIntervalTicks = HASH_INTERVAL_TICKS,
    stallTimeoutTicks = STALL_TIMEOUT_TICKS,
  }) {
    this.transport = transport;
    this.isHost = isHost;
    this.localPlayerId = localPlayerId;
    this.playerIds = playerIds;
    this.playerIdByPeerId = playerIdByPeerId;
    this.hostPlayerId = hostPlayerId;
    this.inputDelayTicks = inputDelayTicks;
    this.hashIntervalTicks = hashIntervalTicks;
    this.stallTimeoutTicks = stallTimeoutTicks;

    this.status = 'running';
    this.desyncTick = null;
    this.disconnectedPlayerId = null;
    // The next tick to run, and the next tick this device still owes an input for.
    this.currentTick = 0;
    this.nextLocalInputTick = inputDelayTicks;
    this.stalledTicks = 0;
    this.completeSetsByTick = new Map();
    this.partialSetsByTick = new Map();
    this.hashesByTick = new Map();
    // No input can be sent for the first ticks yet, so everyone starts them idle.
    for (let tick = 0; tick < inputDelayTicks; tick++) {
      this.completeSetsByTick.set(
        tick,
        this.buildSet(() => cleanInput()),
      );
    }

    transport.onMessage = (peerId, data) => this.handleMessage(peerId, data);
    transport.onPeerClose = (peerId) => this.handlePeerClose(peerId);
  }

  buildSet(inputFor) {
    const set = {};
    for (const playerId of this.playerIds) set[playerId] = inputFor(playerId);
    return set;
  }

  advance(sampleLocalInput) {
    if (this.status !== 'running') return null;

    if (this.nextLocalInputTick === this.currentTick + this.inputDelayTicks) {
      const tick = this.nextLocalInputTick++;
      const input = cleanInput(sampleLocalInput());
      if (this.isHost) this.collectInput(this.localPlayerId, tick, input);
      else this.transport.broadcast({ type: 'input', tick, input });
    }

    const set = this.completeSetsByTick.get(this.currentTick);
    if (!set) {
      this.stalledTicks++;
      if (this.stalledTicks > this.stallTimeoutTicks) this.disconnect(this.findMissingPlayerId());
      return null;
    }
    this.stalledTicks = 0;
    this.completeSetsByTick.delete(this.currentTick);
    this.currentTick++;
    return set;
  }

  completeTick(computeHash) {
    if (this.status !== 'running' || this.currentTick % this.hashIntervalTicks !== 0) return;
    const hash = computeHash();
    if (this.isHost) this.collectHash(this.localPlayerId, this.currentTick, hash);
    else this.transport.broadcast({ type: 'hash', tick: this.currentTick, hash });
  }

  close() {
    this.transport.onMessage = () => {};
    this.transport.onPeerClose = () => {};
    this.transport.close?.();
  }

  collectInput(playerId, tick, input) {
    if (!this.playerIds.includes(playerId) || !Number.isInteger(tick) || tick < this.currentTick) return;
    if (this.completeSetsByTick.has(tick)) return;
    const partialSet = this.partialSetsByTick.get(tick) ?? {};
    if (playerId in partialSet) return;
    partialSet[playerId] = input;
    this.partialSetsByTick.set(tick, partialSet);
    if (Object.keys(partialSet).length < this.playerIds.length) return;

    const set = this.buildSet((id) => partialSet[id]);
    this.partialSetsByTick.delete(tick);
    this.completeSetsByTick.set(tick, set);
    this.transport.broadcast({ type: 'inputs', tick, inputs: set });
  }

  collectHash(playerId, tick, hash) {
    if (!Number.isInteger(tick) || this.hashesByTick.size > this.playerIds.length * 4) return;
    const hashes = this.hashesByTick.get(tick) ?? {};
    hashes[playerId] = hash;
    this.hashesByTick.set(tick, hashes);
    const values = Object.values(hashes);
    if (values.some((value) => value !== values[0])) {
      this.desync(tick);
      this.transport.broadcast({ type: 'desync', tick });
    } else if (values.length === this.playerIds.length) {
      this.hashesByTick.delete(tick);
    }
  }

  handleMessage(peerId, data) {
    if (this.status !== 'running' || !data) return;
    if (this.isHost) {
      const playerId = this.playerIdByPeerId[peerId];
      if (data.type === 'input') this.collectInput(playerId, data.tick, cleanInput(data.input));
      else if (data.type === 'hash' && playerId !== undefined) this.collectHash(playerId, data.tick, data.hash);
      return;
    }
    if (data.type === 'inputs') this.receiveSet(data.tick, data.inputs);
    else if (data.type === 'desync') this.desync(data.tick);
    else if (data.type === 'left') this.disconnect(data.playerId);
  }

  receiveSet(tick, inputs) {
    if (!Number.isInteger(tick) || tick < this.currentTick || this.completeSetsByTick.has(tick)) return;
    this.completeSetsByTick.set(
      tick,
      this.buildSet((playerId) => cleanInput(inputs?.[playerId])),
    );
  }

  handlePeerClose(peerId) {
    if (this.status !== 'running') return;
    this.disconnect(this.isHost ? this.playerIdByPeerId[peerId] : this.hostPlayerId);
  }

  findMissingPlayerId() {
    if (!this.isHost) return this.hostPlayerId;
    const partialSet = this.partialSetsByTick.get(this.currentTick) ?? {};
    return this.playerIds.find((playerId) => !(playerId in partialSet));
  }

  desync(tick) {
    this.status = 'desynced';
    this.desyncTick = tick;
  }

  disconnect(playerId) {
    this.status = 'disconnected';
    this.disconnectedPlayerId = playerId;
    if (this.isHost) this.transport.broadcast({ type: 'left', playerId });
  }
}
