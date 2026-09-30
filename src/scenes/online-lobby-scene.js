import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { EventEmitter } from '../engine/events.js';
import { mergeLocalInputs } from '../engine/input.js';
import { LockstepSession } from '../engine/lockstep-session.js';
import { SeededRandom } from '../engine/seeded-random.js';
import { PLAYERS } from '../levels/versus-arena.js';
import { rowIndexAt, wrapMenuIndex } from '../ui/menu-kit.js';
import { MENU_BACKGROUND_COLOR, NO_WATER_LINE_Y } from '../ui/menu-screen.js';
import { CHANGEABLE_ROWS, drawOnlineLobby, lobbyRowLabels, lobbyRowRectangles } from '../ui/online-lobby-view.js';
import { OnlineLobby } from './online-lobby-state.js';
import { OnlineMatchScene } from './online-match-scene.js';
import { sendMatchSetup, versusSceneOptionsFromSetup } from './online-match-setup.js';
import { VersusScene } from './versus-scene.js';

const HOST_MEMBER_ID = 'host';
const HOST_PLAYER_ID = PLAYERS[0].id;
const HOST_ROWS = ['character', 'ready', 'level', 'start', 'leave'];
const JOINER_ROWS = ['character', 'ready', 'leave'];

// The room before a match, for the host and for joiners. The host owns the lobby and sends it to everyone.
// Joiners only send their own choices. When the host starts, everyone builds the same match from one setup
// message and the lobby comes back after the results.
//
// `connection` is an open OnlineConnection. `onLeave()` returns to the title, `onHostLeft()` tells a joiner
// the room is gone and `onError(code)` reports a connection failure.
export class OnlineLobbyScene {
  constructor({ sceneManager, connection, isHost, levels, sprites, seed, onLeave, onHostLeft, onError }) {
    this.sceneManager = sceneManager;
    this.connection = connection;
    this.isHost = isHost;
    this.levels = levels;
    this.sprites = sprites;
    this.random = new SeededRandom(seed);
    this.onLeave = onLeave;
    this.onHostLeft = onHostLeft;
    this.onError = onError;
    this.events = new EventEmitter();
    this.musicTrackName = 'menu';
    this.waterLineY = NO_WATER_LINE_Y;
    this.backgroundDrawn = false;
    this.rows = isHost ? HOST_ROWS : JOINER_ROWS;
    this.selectedRow = 0;
    this.previousInput = null;
    this.lobby = new OnlineLobby({ levelNames: levels.map((level) => level.name) });
    this.localSeat = isHost ? this.lobby.join(HOST_MEMBER_ID) : -1;
    this.attachConnection();
  }

  get code() {
    return this.connection.code;
  }

  attachConnection() {
    this.connection.onMessage = (peerId, data) => this.handleMessage(peerId, data);
    this.connection.onPeerClose = (peerId) => this.handlePeerClose(peerId);
    this.connection.onError = (error) => {
      if (this.sceneManager.currentScene === this) this.onError(error.code);
    };
    if (this.isHost) {
      this.connection.onPeerOpen = (peerId) => this.handlePeerOpen(peerId);
    }
  }

  // Brings the lobby back after a match. The next update reads the held controls afresh, and the scene
  // gets fresh events because the sound player adds its listeners each time a scene is set.
  resume() {
    this.events = new EventEmitter();
    this.attachConnection();
    this.previousInput = null;
    this.backgroundDrawn = false;
    this.sceneManager.setScene(this);
    if (this.isHost) {
      this.connection.startPolling();
      this.broadcastLobby();
    }
  }

  handlePeerOpen(peerId) {
    if (this.lobby.join(peerId) >= 0) this.broadcastLobby();
  }

  handlePeerClose(peerId) {
    if (this.isHost) {
      this.removePeer(peerId);
    } else if (this.sceneManager.currentScene === this) {
      this.connection.close();
      this.onHostLeft();
    }
  }

  removePeer(peerId) {
    if (this.lobby.leave(peerId)) this.broadcastLobby();
  }

  broadcastLobby() {
    const snapshot = this.lobby.snapshot();
    this.lobby.seats.forEach((seat, seatIndex) => {
      if (seat && seat.memberId !== HOST_MEMBER_ID) {
        this.connection.send(seat.memberId, { type: 'lobby-state', snapshot, seat: seatIndex });
      }
    });
  }

  handleMessage(peerId, data) {
    if (this.isHost) {
      if (data?.type === 'lobby-choice') this.applyChoice(peerId, data);
      return;
    }
    if (data?.type === 'lobby-state') {
      this.lobby.load(data.snapshot);
      this.localSeat = Number.isInteger(data.seat) ? data.seat : -1;
    } else if (data?.type === 'match-setup') {
      this.beginMatch(data.setup, { localPlayerId: PLAYERS[this.localSeat].id, playerIdByPeerId: {} });
    }
  }

  applyChoice(peerId, { choice, direction, ready }) {
    let changed = false;
    if (choice === 'character' && (direction === 1 || direction === -1)) {
      changed = this.lobby.changeCharacter(peerId, direction);
    } else if (choice === 'ready' && typeof ready === 'boolean') {
      changed = this.lobby.setReady(peerId, ready);
    }
    if (changed) this.broadcastLobby();
  }

  update(inputByPlayerId) {
    const input = mergeLocalInputs(inputByPlayerId);
    if (!this.previousInput) {
      this.previousInput = input;
      return;
    }
    const previous = this.previousInput;
    const isFresh = (control) => input[control] && !previous[control];
    this.previousInput = input;

    const rowCount = this.rows.length;
    if (isFresh('down')) this.selectedRow = wrapMenuIndex(this.selectedRow, 1, rowCount);
    if (isFresh('up')) this.selectedRow = wrapMenuIndex(this.selectedRow, -1, rowCount);
    if (isFresh('down') || isFresh('up')) this.events.emit('menu-moved', {});
    const row = this.rows[this.selectedRow];
    if (isFresh('left') && CHANGEABLE_ROWS.includes(row)) this.changeRow(row, -1);
    if (isFresh('right') && CHANGEABLE_ROWS.includes(row)) this.changeRow(row, 1);
    if (isFresh('confirm')) this.activateRow(row, inputByPlayerId);
    this.handleTap(input.tap, inputByPlayerId);
  }

  // A tap on a row that changes with left and right steps it by the side that was tapped. Any other row is chosen.
  handleTap(tap, inputByPlayerId) {
    const rectangles = lobbyRowRectangles(lobbyRowLabels(this));
    const tappedIndex = rowIndexAt(rectangles, tap);
    if (tappedIndex < 0) return;
    this.selectedRow = tappedIndex;
    const row = this.rows[tappedIndex];
    if (CHANGEABLE_ROWS.includes(row)) {
      const rectangle = rectangles[tappedIndex];
      this.changeRow(row, tap.x < rectangle.x + rectangle.width / 2 ? -1 : 1);
    } else {
      this.activateRow(row, inputByPlayerId);
    }
  }

  changeRow(row, direction) {
    this.events.emit('menu-moved', {});
    if (row === 'level') {
      this.lobby.changeLevel(direction);
      this.broadcastLobby();
    } else if (this.isHost) {
      this.lobby.changeCharacter(HOST_MEMBER_ID, direction);
      this.broadcastLobby();
    } else {
      this.connection.send(this.hostPeerId, { type: 'lobby-choice', choice: 'character', direction });
    }
  }

  activateRow(row, inputByPlayerId) {
    if (row === 'ready') this.toggleReady();
    else if (row === 'start' && this.lobby.canStart()) this.startHostMatch();
    else if (row === 'leave') this.leave(inputByPlayerId);
    else return;
    this.events.emit('menu-selected', {});
  }

  get hostPeerId() {
    return this.connection.peerIds[0];
  }

  toggleReady() {
    if (this.isHost) {
      this.lobby.toggleReady(HOST_MEMBER_ID);
      this.broadcastLobby();
    } else {
      const ready = !this.lobby.seats[this.localSeat]?.ready;
      this.connection.send(this.hostPeerId, { type: 'lobby-choice', choice: 'ready', ready });
    }
  }

  leave(inputByPlayerId) {
    this.connection.close();
    this.onLeave(inputByPlayerId);
  }

  startHostMatch() {
    const setup = this.lobby.matchSetup(Math.floor(this.random.next() * 0xffffffff));
    const playerIdByPeerId = this.lobby.playerIdByMemberId();
    delete playerIdByPeerId[HOST_MEMBER_ID];
    this.connection.stopPolling();
    this.beginMatch(setup, { localPlayerId: HOST_PLAYER_ID, playerIdByPeerId });
    sendMatchSetup(this.connection, setup);
  }

  // Builds the lockstep session and the match straight away, so no message from the other devices is missed.
  beginMatch(setup, { localPlayerId, playerIdByPeerId }) {
    const session = new LockstepSession({
      transport: this.connection,
      isHost: this.isHost,
      localPlayerId,
      playerIds: setup.players.map((player) => player.id),
      playerIdByPeerId,
      hostPlayerId: HOST_PLAYER_ID,
    });
    const matchScene = new VersusScene({
      ...versusSceneOptionsFromSetup(setup, this.levels),
      sprites: this.sprites,
      levels: this.levels,
    });
    this.sceneManager.setScene(
      new OnlineMatchScene({
        sceneManager: this.sceneManager,
        matchScene,
        session,
        isHost: this.isHost,
        onReturnToLobby: () => this.resume(),
        onPeerLeft: (peerId) => this.removePeer(peerId),
      }),
    );
  }

  render(renderer) {
    if (!this.backgroundDrawn) {
      renderer.updateBackground((context) => {
        context.fillStyle = MENU_BACKGROUND_COLOR;
        context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      });
      this.backgroundDrawn = true;
    }
    renderer.clearGameLayer();
    renderer.clearUiLayer();
    drawOnlineLobby(renderer.uiContext, {
      code: this.code,
      lobby: this.lobby,
      localSeat: this.localSeat,
      isHost: this.isHost,
      rows: this.rows,
      selectedRow: this.selectedRow,
      sprites: this.sprites,
      levels: this.levels,
      touchActive: renderer.touchActive,
    });
  }
}
