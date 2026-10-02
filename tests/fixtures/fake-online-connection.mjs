// Stands in for an OnlineConnection. Everything a scene sends is kept in `sent`, and the test calls the
// `on...` handlers the way the real connection would when something arrives.
export class FakeOnlineConnection {
  constructor({ code = 'ABCD', peerIds = [] } = {}) {
    this.code = code;
    this.peerIds = peerIds;
    this.sent = [];
    this.closed = false;
    this.polling = true;
    this.onPeerOpen = () => {};
    this.onPeerClose = () => {};
    this.onMessage = () => {};
    this.onError = () => {};
  }

  send(peerId, data) {
    this.sent.push({ to: peerId, data: JSON.parse(JSON.stringify(data)) });
  }

  broadcast(data) {
    for (const peerId of this.peerIds) this.send(peerId, data);
  }

  startPolling() {
    this.polling = true;
  }

  stopPolling() {
    this.polling = false;
  }

  close() {
    this.closed = true;
  }

  sentOfType(type) {
    return this.sent.filter((message) => message.data.type === type);
  }
}

export function fakeSceneManager() {
  return {
    currentScene: null,
    setScene(scene) {
      this.currentScene = scene;
    },
  };
}

export function idleInput() {
  return {
    left: false,
    right: false,
    jump: false,
    up: false,
    down: false,
    action: false,
    confirm: false,
    pause: false,
  };
}

// One scene update with the given controls held, then one with everything released.
export function pressOnce(scene, controls) {
  scene.update({ red: { ...idleInput(), ...controls }, blue: idleInput() });
  scene.update({ red: idleInput(), blue: idleInput() });
}
