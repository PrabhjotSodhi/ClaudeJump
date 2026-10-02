import assert from 'node:assert/strict';
import { test } from 'node:test';

// Just enough of the browser for a host with one joiner: a page to hide, a rooms function and WebRTC.
const page = new EventTarget();
globalThis.addEventListener = page.addEventListener.bind(page);
globalThis.removeEventListener = page.removeEventListener.bind(page);

const roomRequests = [];
globalThis.fetch = async (url, options = {}) => {
  const action = url.split('/').pop().split('?')[0];
  roomRequests.push({ action, body: options.body ? JSON.parse(options.body) : null });
  const results = {
    create: { code: 'ABCD', hostId: 'host' },
    poll: { messages: [{ id: 'm1', from: 'joiner', payload: { type: 'joined' } }] },
  };
  return { ok: true, json: async () => results[action] ?? {} };
};

const peerConnections = [];
globalThis.RTCPeerConnection = class {
  constructor() {
    this.connectionState = 'new';
    this.closed = false;
    peerConnections.push(this);
  }
  createDataChannel() {
    this.channel = { readyState: 'connecting', send() {} };
    return this.channel;
  }
  async createOffer() {
    return { type: 'offer' };
  }
  async setLocalDescription(description) {
    this.localDescription = description;
  }
  close() {
    this.closed = true;
  }
};

const { hostRoom } = await import('../src/engine/online-connection.js');

async function hostWithOpenJoiner() {
  peerConnections.length = 0;
  roomRequests.length = 0;
  const connection = await hostRoom();
  const closedPeerIds = [];
  connection.onPeerClose = (peerId) => closedPeerIds.push(peerId);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const [peerConnection] = peerConnections;
  peerConnection.channel.readyState = 'open';
  peerConnection.channel.onopen();
  return { connection, peerConnection, closedPeerIds };
}

test('the host drops a joiner whose connection fails without its channel closing', async (context) => {
  const { connection, peerConnection, closedPeerIds } = await hostWithOpenJoiner();
  context.after(() => connection.close());
  assert.deepEqual(connection.peerIds, ['joiner']);

  peerConnection.connectionState = 'failed';
  peerConnection.onconnectionstatechange();

  assert.deepEqual(closedPeerIds, ['joiner']);
  assert.deepEqual(connection.peerIds, []);
  assert.ok(peerConnection.closed);
  assert.ok(roomRequests.some(({ action, body }) => action === 'leave' && body.leaverId === 'joiner'));
});

test('hiding the page closes the connection so the others hear at once', async (context) => {
  const { connection, peerConnection } = await hostWithOpenJoiner();
  context.after(() => connection.close());

  page.dispatchEvent(new Event('pagehide'));

  assert.ok(connection.closed);
  assert.ok(peerConnection.closed);
});
