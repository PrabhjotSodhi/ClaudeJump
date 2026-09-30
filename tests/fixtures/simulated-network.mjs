import { SeededRandom } from '../../src/engine/seeded-random.js';

// An in-memory star network. Every message is copied through JSON like a real data channel and arrives
// after a random number of steps, so messages sent close together can arrive out of order.
// `shapeMessage({ from, to, data })` may return 'drop' or a number of extra steps of delay.
export class SimulatedNetwork {
  constructor({ seed, maxDelaySteps, shapeMessage = () => 0 }) {
    this.random = new SeededRandom(seed);
    this.maxDelaySteps = maxDelaySteps;
    this.shapeMessage = shapeMessage;
    this.step = 0;
    this.inFlight = [];
    this.transports = new Map();
  }

  // Joiners are connected to the host only. Peer ids are the player ids.
  addTransport(playerId, connectedPlayerIds) {
    const network = this;
    const transport = {
      onMessage: () => {},
      onPeerClose: () => {},
      connectedPlayerIds,
      closed: false,
      send(peerId, data) {
        network.enqueue(playerId, peerId, data);
      },
      broadcast(data) {
        for (const peerId of connectedPlayerIds) network.enqueue(playerId, peerId, data);
      },
      close() {
        transport.closed = true;
        network.closeConnectionsOf(playerId);
      },
    };
    this.transports.set(playerId, transport);
    return transport;
  }

  enqueue(from, to, data) {
    const shape = this.shapeMessage({ from, to, data });
    if (shape === 'drop') return;
    const delay = Math.floor(this.random.next() * (this.maxDelaySteps + 1)) + shape;
    this.inFlight.push({ from, to, data: JSON.parse(JSON.stringify(data)), deliverAtStep: this.step + delay });
  }

  closeConnectionsOf(playerId) {
    for (const [otherId, transport] of this.transports) {
      if (otherId !== playerId && transport.connectedPlayerIds.includes(playerId)) transport.onPeerClose(playerId);
    }
  }

  advance() {
    this.step++;
    const due = this.inFlight.filter((message) => message.deliverAtStep <= this.step);
    this.inFlight = this.inFlight.filter((message) => message.deliverAtStep > this.step);
    due.sort((first, second) => first.deliverAtStep - second.deliverAtStep);
    for (const message of due) this.transports.get(message.to)?.onMessage(message.from, message.data);
  }
}
