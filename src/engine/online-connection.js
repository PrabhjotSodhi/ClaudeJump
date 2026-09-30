const ROOMS_ENDPOINT = '/api/rooms';
const STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
const POLL_INTERVAL_MILLISECONDS = 1000;
const CONNECT_TIMEOUT_MILLISECONDS = 20000;
const MAX_JOINERS = 3;

// Error codes: no-webrtc, room-not-found, room-expired, room-full, connection-failed, server-error.
export class OnlineError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

async function requestRooms(endpoint, action, { body, query } = {}) {
  let response;
  try {
    response = await fetch(
      `${endpoint}/${action}${query ? `?${new URLSearchParams(query)}` : ''}`,
      body ? { method: 'POST', body: JSON.stringify(body) } : {},
    );
  } catch {
    throw new OnlineError('server-error');
  }
  const result = await response.json().catch(() => ({}));
  if (response.ok) return result;
  const known = ['room-not-found', 'room-expired', 'room-full'];
  throw new OnlineError(known.includes(result.error) ? result.error : 'server-error');
}

// One room seen from one device. The host has a peer for every joiner and the
// joiner has one peer, the host. Set `onPeerOpen(peerId)`, `onPeerClose(peerId)`,
// `onMessage(peerId, data)` and `onError(error)` before players join. Messages
// go straight between devices on a reliable, ordered data channel. The rooms
// function is only polled while peers are still connecting.
class OnlineConnection {
  constructor({ endpoint, code, playerId, isHost }) {
    this.endpoint = endpoint;
    this.code = code;
    this.playerId = playerId;
    this.isHost = isHost;
    this.onPeerOpen = () => {};
    this.onPeerClose = () => {};
    this.onMessage = () => {};
    this.onError = () => {};
    this.peers = new Map();
    this.lastMessageId = '';
    this.pollTimer = null;
    this.pollingEnabled = false;
    this.closed = false;
  }

  get peerIds() {
    return [...this.peers.keys()].filter((peerId) => this.peers.get(peerId).channel?.readyState === 'open');
  }

  send(peerId, data) {
    const channel = this.peers.get(peerId)?.channel;
    if (channel?.readyState === 'open') channel.send(JSON.stringify(data));
  }

  broadcast(data) {
    for (const peerId of this.peerIds) this.send(peerId, data);
  }

  startPolling() {
    this.pollingEnabled = true;
    if (this.pollTimer === null && !this.closed) this.pollTimer = setTimeout(() => this.poll(), 0);
  }

  stopPolling() {
    this.pollingEnabled = false;
    clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }

  close() {
    this.closed = true;
    this.stopPolling();
    for (const peer of this.peers.values()) {
      clearTimeout(peer.timeoutTimer);
      peer.connection.close();
    }
    this.peers.clear();
  }

  fail(error) {
    if (this.closed) return;
    this.close();
    this.onError(error);
  }

  async poll() {
    this.pollTimer = null;
    try {
      const { messages } = await requestRooms(this.endpoint, 'poll', {
        query: { code: this.code, playerId: this.playerId, after: this.lastMessageId },
      });
      for (const message of messages) {
        this.lastMessageId = message.id;
        await this.handleSignal(message.from, message.payload);
      }
    } catch (error) {
      if (error.code === 'room-expired' || error.code === 'room-not-found') {
        this.fail(new OnlineError('connection-failed'));
        return;
      }
    }
    if (this.pollingEnabled && !this.closed && this.isWaitingForPeers()) {
      this.pollTimer = setTimeout(() => this.poll(), POLL_INTERVAL_MILLISECONDS);
    }
  }

  isWaitingForPeers() {
    if (!this.isHost) return this.peerIds.length === 0;
    return this.peers.size < MAX_JOINERS;
  }

  sendSignal(peerId, payload) {
    return requestRooms(this.endpoint, 'signal', {
      body: { code: this.code, from: this.playerId, to: peerId, payload },
    }).catch((error) => this.fail(error));
  }

  createPeer(peerId) {
    const connection = new RTCPeerConnection({ iceServers: STUN_SERVERS });
    const peer = { connection, channel: null, pendingCandidates: [], timeoutTimer: null };
    this.peers.set(peerId, peer);
    connection.onicecandidate = (event) => {
      if (event.candidate) this.sendSignal(peerId, { type: 'candidate', candidate: event.candidate });
    };
    peer.timeoutTimer = setTimeout(() => {
      if (peer.channel?.readyState !== 'open') this.fail(new OnlineError('connection-failed'));
    }, CONNECT_TIMEOUT_MILLISECONDS);
    return peer;
  }

  watchChannel(peerId, peer, channel) {
    peer.channel = channel;
    channel.onopen = () => {
      clearTimeout(peer.timeoutTimer);
      this.onPeerOpen(peerId);
      if (!this.isWaitingForPeers()) this.stopPolling();
    };
    channel.onclose = () => {
      if (!this.closed) this.onPeerClose(peerId);
    };
    channel.onmessage = (event) => this.onMessage(peerId, JSON.parse(event.data));
  }

  async handleSignal(peerId, payload) {
    if (payload.type === 'joined') {
      const peer = this.createPeer(peerId);
      this.watchChannel(peerId, peer, peer.connection.createDataChannel('game'));
      await peer.connection.setLocalDescription(await peer.connection.createOffer());
      await this.sendSignal(peerId, { type: 'offer', description: peer.connection.localDescription });
      return;
    }
    if (payload.type === 'offer') {
      const peer = this.createPeer(peerId);
      peer.connection.ondatachannel = (event) => this.watchChannel(peerId, peer, event.channel);
      await peer.connection.setRemoteDescription(payload.description);
      await peer.connection.setLocalDescription(await peer.connection.createAnswer());
      await this.sendSignal(peerId, { type: 'answer', description: peer.connection.localDescription });
      await this.addPendingCandidates(peer);
      return;
    }
    const peer = this.peers.get(peerId);
    if (!peer) return;
    if (payload.type === 'answer') {
      await peer.connection.setRemoteDescription(payload.description);
      await this.addPendingCandidates(peer);
    } else if (payload.type === 'candidate') {
      if (peer.connection.remoteDescription) await peer.connection.addIceCandidate(payload.candidate);
      else peer.pendingCandidates.push(payload.candidate);
    }
  }

  async addPendingCandidates(peer) {
    for (const candidate of peer.pendingCandidates.splice(0)) {
      await peer.connection.addIceCandidate(candidate);
    }
  }
}

function requireWebRtc() {
  if (typeof RTCPeerConnection === 'undefined') throw new OnlineError('no-webrtc');
}

// Creates a room. Share `connection.code`. Call `connection.stopPolling()` when
// the match starts; polling also stops once three players have joined.
export async function hostRoom({ endpoint = ROOMS_ENDPOINT } = {}) {
  requireWebRtc();
  const { code, hostId } = await requestRooms(endpoint, 'create', { body: {} });
  const connection = new OnlineConnection({ endpoint, code, playerId: hostId, isHost: true });
  connection.startPolling();
  return connection;
}

// Joins a room by code. Resolves once the data channel to the host is open.
export async function joinRoom(code, { endpoint = ROOMS_ENDPOINT } = {}) {
  requireWebRtc();
  const { playerId } = await requestRooms(endpoint, 'join', { body: { code } });
  const connection = new OnlineConnection({ endpoint, code: code.toUpperCase(), playerId, isHost: false });
  return new Promise((resolve, reject) => {
    connection.onPeerOpen = () => resolve(connection);
    connection.onError = reject;
    connection.startPolling();
  });
}
