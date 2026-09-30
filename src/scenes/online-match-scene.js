import { ONLINE_MESSAGE_TICKS, STALL_MESSAGE_TICKS, SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { stateHash } from '../engine/state-hash.js';
import { PLAYERS } from '../levels/versus-arena.js';
import { drawPanel } from '../ui/panel.js';
import { drawText } from '../ui/text.js';
import { TitleScene } from './title-scene.js';

const MESSAGE_TITLE_Y = 150;
const MESSAGE_DETAIL_Y = 176;
const TITLE_COLOR = '#ffffff';
const BACKDROP_COLOR = 'rgba(24, 20, 37, 0.8)';

// Runs a match scene from a lockstep session. The match scene never sees the network: it gets the
// full input of every player on the tick, exactly as it does offline. Only the input of the local
// player, taken from the `controlId` keys, is sent out.
export class OnlineMatchScene {
  constructor({ sceneManager, matchScene, session, controlId = 'red' }) {
    this.sceneManager = sceneManager;
    this.matchScene = matchScene;
    this.session = session;
    this.controlId = controlId;
    this.events = matchScene.events;
    this.musicTrackName = 'match';
    this.messageTicks = 0;
  }

  get waterLineY() {
    return this.matchScene.waterLineY;
  }

  update(inputByPlayerId) {
    if (this.session.status !== 'running') {
      this.updateMessage();
      return;
    }
    const inputs = this.session.advance(() => inputByPlayerId[this.controlId]);
    if (!inputs) return;
    this.matchScene.update(inputs);
    this.session.completeTick(() => stateHash(this.matchScene));
  }

  updateMessage() {
    this.messageTicks++;
    if (this.messageTicks < ONLINE_MESSAGE_TICKS) return;
    this.session.close();
    this.sceneManager.setScene(
      new TitleScene({
        sceneManager: this.sceneManager,
        levels: this.matchScene.levels,
        sprites: this.matchScene.sprites,
        seed: Math.floor(this.matchScene.random.next() * 0xffffffff),
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
    if (this.session.status === 'desynced') return ['Out of sync', 'The match has ended'];
    if (this.session.status === 'disconnected') {
      return [`${this.playerLabel(this.session.disconnectedPlayerId)} disconnected`, 'Returning to the title'];
    }
    if (this.session.stalledTicks >= STALL_MESSAGE_TICKS) return ['Waiting for players'];
    return null;
  }

  render(renderer) {
    this.matchScene.render(renderer);
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
}
