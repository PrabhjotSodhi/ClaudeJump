import { ONLINE_MESSAGE_TICKS, STALL_MESSAGE_TICKS, SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { mergeLocalInputs } from '../engine/input.js';
import { stateHash } from '../engine/state-hash.js';
import { PLAYERS } from '../levels/versus-arena.js';
import { AwardReveal } from '../ui/award-reveal.js';
import { pickAwards } from '../ui/match-stats.js';
import { drawWithMenuMotion, MenuMotion, menuPanelSize, rowIndexAt, wrapMenuIndex } from '../ui/menu-kit.js';
import { drawPanel } from '../ui/panel.js';
import { drawResultsMenu, resultsLayout, resultsMenuRowRectangles } from '../ui/results-menu.js';
import { drawText } from '../ui/text.js';
import { TitleScene } from './title-scene.js';

const MESSAGE_TITLE_Y = 150;
const MESSAGE_DETAIL_Y = 176;
const TITLE_COLOR = '#ffffff';
const BACKDROP_COLOR = 'rgba(24, 20, 37, 0.8)';
const WAITING_CAPTION = 'Waiting for the host';
const WAITING_CAPTION_GAP = 10;

const HOST_RESULTS_OPTIONS = [
  { id: 'rematch', label: 'Rematch' },
  { id: 'leave', label: 'Leave' },
];
const JOINER_RESULTS_OPTIONS = [{ id: 'leave', label: 'Leave' }];

// Runs a match scene from a lockstep session. The match scene never sees the network: it gets the
// full input of every player on the tick, exactly as it does offline. Only the input of the local
// device is sent out. It comes from the `controlId` keys, or from every local control when there is no
// `controlId`, since one device plays one player.
//
// When the match is over the session is done and the results show. The host can start a rematch, which
// sends everyone back to the lobby through `onReturnToLobby()`. Anyone can leave. `onPeerLeft(peerId)`
// tells the host's lobby that a joiner left from the results.
export class OnlineMatchScene {
  constructor({
    sceneManager,
    matchScene,
    session,
    controlId = null,
    isHost = false,
    onReturnToLobby = () => {},
    onPeerLeft = () => {},
  }) {
    this.touchLayout = 'onePlayer';
    this.sceneManager = sceneManager;
    this.matchScene = matchScene;
    this.session = session;
    this.controlId = controlId;
    this.isHost = isHost;
    this.onReturnToLobby = onReturnToLobby;
    this.onPeerLeft = onPeerLeft;
    this.events = matchScene.events;
    this.musicTrackName = 'match';
    this.messageTicks = 0;
    this.hostLeft = false;
    this.resultsOpen = false;
    this.resultsMotion = new MenuMotion();
    this.resultsSelectedIndex = 0;
    this.awardReveal = null;
    this.previousInput = null;
  }

  get waterLineY() {
    return this.matchScene.waterLineY;
  }

  get showingResults() {
    return this.matchScene.phase === 'match' && this.matchScene.ticksRemaining <= 0;
  }

  get resultsOptions() {
    return this.isHost ? HOST_RESULTS_OPTIONS : JOINER_RESULTS_OPTIONS;
  }

  update(inputByPlayerId) {
    if (this.hostLeft || this.session.status !== 'running') {
      this.updateMessage(inputByPlayerId);
      return;
    }
    const localInput = this.controlId ? inputByPlayerId[this.controlId] : mergeLocalInputs(inputByPlayerId);
    if (this.showingResults) {
      this.updateResults(localInput, inputByPlayerId);
      return;
    }
    const inputs = this.session.advance(() => localInput);
    if (!inputs) return;
    this.matchScene.update(inputs);
    this.session.completeTick(() => stateHash(this.matchScene));
  }

  // Every device sees the results on the same tick, so none of them needs another input from the others.
  // From here the room messages go to this scene instead of the session.
  updateResults(localInput, inputByPlayerId) {
    this.matchScene.update({});
    if (!this.resultsOpen) {
      this.resultsOpen = true;
      this.resultsMotion = new MenuMotion();
      this.awardReveal = new AwardReveal(
        pickAwards(
          this.matchScene.matchStats,
          this.matchScene.players.map((player) => player.id),
        ),
        this.events,
      );
      this.previousInput = localInput;
      const transport = this.session.transport;
      transport.onMessage = (peerId, data) => this.handleRoomMessage(data);
      transport.onPeerClose = (peerId) => this.handlePeerClose(peerId);
      return;
    }
    const previous = this.previousInput;
    const isFresh = (control) => localInput[control] && !previous[control];
    this.previousInput = localInput;

    const optionCount = this.resultsOptions.length;
    this.resultsMotion.update();
    this.awardReveal.update();
    if (isFresh('down')) this.resultsSelectedIndex = wrapMenuIndex(this.resultsSelectedIndex, 1, optionCount);
    if (isFresh('up')) this.resultsSelectedIndex = wrapMenuIndex(this.resultsSelectedIndex, -1, optionCount);
    if (isFresh('down') || isFresh('up')) this.events.emit('menu-moved', {});
    const tappedIndex = rowIndexAt(resultsMenuRowRectangles(this.resultsOptions), localInput.tap);
    if (tappedIndex >= 0) this.resultsSelectedIndex = tappedIndex;
    if (isFresh('confirm') || tappedIndex >= 0) {
      this.events.emit('menu-selected', {});
      this.resultsMotion.press();
      this.chooseResultsOption(this.resultsOptions[this.resultsSelectedIndex].id, inputByPlayerId);
    }
  }

  chooseResultsOption(optionId, inputByPlayerId) {
    if (optionId === 'rematch') {
      this.session.transport.broadcast({ type: 'return-to-lobby' });
      this.onReturnToLobby();
    } else {
      this.session.close();
      this.returnToTitle(inputByPlayerId);
    }
  }

  handleRoomMessage(data) {
    if (!this.isHost && data?.type === 'return-to-lobby') this.onReturnToLobby();
  }

  handlePeerClose(peerId) {
    if (this.isHost) this.onPeerLeft(peerId);
    else this.hostLeft = true;
  }

  updateMessage(inputByPlayerId) {
    this.messageTicks++;
    if (this.messageTicks < ONLINE_MESSAGE_TICKS) return;
    this.session.close();
    this.returnToTitle(inputByPlayerId);
  }

  returnToTitle(inputByPlayerId) {
    this.sceneManager.setScene(
      new TitleScene({
        sceneManager: this.sceneManager,
        levels: this.matchScene.levels,
        sprites: this.matchScene.sprites,
        seed: Math.floor(this.matchScene.random.next() * 0xffffffff),
        initialInput: inputByPlayerId,
      }),
    );
  }

  playerLabel(playerId) {
    const seatIndex = this.session.playerIds.indexOf(playerId);
    return seatIndex < 0 ? 'A player' : `P${seatIndex + 1}`;
  }

  messageColor() {
    const disconnectedId = this.session.disconnectedPlayerId;
    if (this.session.status !== 'disconnected' || !disconnectedId) return TITLE_COLOR;
    return PLAYERS.find((player) => player.id === disconnectedId)?.color ?? TITLE_COLOR;
  }

  messageLines() {
    if (this.hostLeft) return ['The host left', 'Returning to the title'];
    if (this.session.status === 'desynced') return ['Out of sync', 'The match has ended'];
    if (this.session.status === 'disconnected') {
      const { disconnectedPlayerId, hostPlayerId, isHost } = this.session;
      if (!isHost && disconnectedPlayerId === hostPlayerId) return ['The host left', 'Returning to the title'];
      return [`${this.playerLabel(disconnectedPlayerId)} disconnected`, 'Returning to the title'];
    }
    if (this.session.stalledTicks >= STALL_MESSAGE_TICKS) return ['Waiting for players'];
    return null;
  }

  render(renderer) {
    this.matchScene.render(renderer);
    if (this.resultsOpen && !this.hostLeft) this.renderResults(renderer.uiContext);
    const lines = this.messageLines();
    if (!lines) return;
    const context = renderer.uiContext;
    context.fillStyle = BACKDROP_COLOR;
    context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    drawPanel(context, SCREEN_WIDTH / 2 - 120, MESSAGE_TITLE_Y - 14, 240, lines.length > 1 ? 66 : 40);
    drawText(context, lines[0], SCREEN_WIDTH / 2, MESSAGE_TITLE_Y, {
      scale: 2,
      align: 'center',
      color: this.messageColor(),
    });
    if (lines[1]) {
      drawText(context, lines[1], SCREEN_WIDTH / 2, MESSAGE_DETAIL_Y, {
        scale: 1,
        align: 'center',
        outlineColor: null,
      });
    }
  }

  renderResults(context) {
    drawResultsMenu(context, {
      matchScene: this.matchScene,
      options: this.resultsOptions,
      selectedIndex: this.resultsSelectedIndex,
      motion: this.resultsMotion,
      awardReveal: this.awardReveal,
    });
    if (this.isHost) return;
    const winnerIndex = this.matchScene.players.findIndex((player) => player.id === this.matchScene.winnerId);
    const { hintBottomY } = resultsLayout({
      winnerIndex,
      playerCount: this.matchScene.players.length,
      menuHeight: menuPanelSize(this.resultsOptions.map((option) => option.label)).height,
    });
    drawWithMenuMotion(context, this.resultsMotion, () =>
      drawText(context, WAITING_CAPTION, SCREEN_WIDTH / 2, hintBottomY + WAITING_CAPTION_GAP, {
        scale: 1,
        align: 'center',
        color: '#c0cbdc',
        outlineColor: null,
      }),
    );
  }
}
