import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { Player } from '../entities/player.js';
import { PLAYER_SPAWNS } from '../levels/versus-arena.js';
import { drawText } from '../ui/text.js';
import { VersusScene } from './versus-scene.js';

const BACKGROUND_COLOR = '#141428';
const TITLE_Y = 30;
const TITLE_SCALE = 3;
// Above the tallest wave crest the water shader draws, so no water shows on this screen.
const NO_WATER_LINE_Y = SCREEN_HEIGHT + 2;

const CARD_TOP_Y = 55;
const CARD_WIDTH = 84;
const CARD_HEIGHT = 100;
const CARD_OFFSET_X = 74;
const CARD_LABEL_Y = CARD_TOP_Y + 8;
const PORTRAIT_SCALE = 4;
const PORTRAIT_TOP_Y = CARD_TOP_Y + 22;
const STATUS_TEXT_Y = CARD_TOP_Y + CARD_HEIGHT - 16;

const READY_COLOR = '#ffdc28';

const STATUS_LABEL = {
  unjoined: 'Press jump to join',
  joined: 'Press jump when ready',
  ready: 'READY!',
};

export class PlayerSelectScene {
  constructor({ sceneManager, seed = Date.now() } = {}) {
    this.sceneManager = sceneManager;
    this.seed = seed;
    this.waterLineY = NO_WATER_LINE_Y;
    this.backgroundDrawn = false;
    // Captured from the real input on the first tick this scene runs, so a jump still held from
    // the title screen's confirm press never counts as a fresh press here.
    this.jumpBaseline = null;
    this.stateByPlayerId = {};
    for (const spawn of PLAYER_SPAWNS) this.stateByPlayerId[spawn.id] = 'unjoined';
  }

  update(inputByPlayerId) {
    if (!this.jumpBaseline) {
      this.jumpBaseline = {};
      for (const spawn of PLAYER_SPAWNS) this.jumpBaseline[spawn.id] = inputByPlayerId[spawn.id]?.jump ?? false;
      return;
    }

    for (const spawn of PLAYER_SPAWNS) {
      const jumpPressed = inputByPlayerId[spawn.id]?.jump ?? false;
      if (jumpPressed && !this.jumpBaseline[spawn.id]) this.advance(spawn.id);
      this.jumpBaseline[spawn.id] = jumpPressed;
    }

    if (Object.values(this.stateByPlayerId).every((state) => state === 'ready')) {
      this.sceneManager.setScene(new VersusScene({ seed: this.seed }));
    }
  }

  advance(playerId) {
    const state = this.stateByPlayerId[playerId];
    if (state === 'unjoined') this.stateByPlayerId[playerId] = 'joined';
    else if (state === 'joined') this.stateByPlayerId[playerId] = 'ready';
  }

  render(renderer) {
    if (!this.backgroundDrawn) {
      renderer.updateBackground((context) => drawPlayerSelectBackground(context));
      this.backgroundDrawn = true;
    }

    renderer.clearGameLayer();
    renderer.clearUiLayer();
    drawPlayerSelectUi(renderer.uiContext, this);
  }
}

function drawPlayerSelectBackground(context) {
  context.fillStyle = BACKGROUND_COLOR;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
}

function drawPlayerCard(context, spawn, state) {
  const columnIndex = PLAYER_SPAWNS.indexOf(spawn);
  const centerX = SCREEN_WIDTH / 2 + (columnIndex === 0 ? -CARD_OFFSET_X : CARD_OFFSET_X);
  const cardX = Math.round(centerX - CARD_WIDTH / 2);

  context.strokeStyle = spawn.color;
  context.lineWidth = 1;
  context.strokeRect(cardX + 0.5, CARD_TOP_Y + 0.5, CARD_WIDTH - 1, CARD_HEIGHT - 1);

  drawText(context, `${spawn.id[0].toUpperCase()}${spawn.id.slice(1)}`, centerX, CARD_LABEL_Y, {
    align: 'center',
    color: spawn.color,
  });

  if (state !== 'unjoined') drawPlayerPortrait(context, spawn, centerX, PORTRAIT_TOP_Y);

  drawText(context, STATUS_LABEL[state], centerX, STATUS_TEXT_Y, {
    align: 'center',
    color: state === 'ready' ? READY_COLOR : spawn.color,
  });
}

// Reuses the player's own in-game drawing, magnified so it reads clearly on the card.
function drawPlayerPortrait(context, spawn, centerX, topY) {
  const player = new Player(spawn);
  player.y = 0;
  context.save();
  context.translate(Math.round(centerX - (player.width * PORTRAIT_SCALE) / 2), Math.round(topY));
  context.scale(PORTRAIT_SCALE, PORTRAIT_SCALE);
  player.renderAt(context, 0);
  context.restore();
}

function drawPlayerSelectUi(context, scene) {
  drawText(context, 'Player Select', SCREEN_WIDTH / 2, TITLE_Y, { scale: TITLE_SCALE, align: 'center' });

  for (const spawn of PLAYER_SPAWNS) drawPlayerCard(context, spawn, scene.stateByPlayerId[spawn.id]);
}
