import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { SeededRandom } from '../engine/seeded-random.js';
import { Player } from '../entities/player.js';
import { PLAYERS } from '../levels/versus-arena.js';
import { MENU_BACKGROUND_COLOR, NO_WATER_LINE_Y } from '../ui/menu-screen.js';
import { drawText } from '../ui/text.js';
import { PausableMatchScene } from './pausable-match-scene.js';
import { VersusScene } from './versus-scene.js';

const TITLE_Y = 60;
const TITLE_SCALE = 6;

const CARD_TOP_Y = 110;
const CARD_WIDTH = 168;
const CARD_HEIGHT = 200;
const CARD_OFFSET_X = 148;
const CARD_LABEL_Y = CARD_TOP_Y + 16;
const PORTRAIT_SCALE = 3;
const PORTRAIT_TOP_Y = CARD_TOP_Y + 44;
// The status sits in the last two text rows above the card's bottom edge, so both a wrapped
// two-line status and the single-line READY! stay inside the card with room to spare.
const STATUS_TEXT_TOP_Y = CARD_TOP_Y + CARD_HEIGHT - 46;
const STATUS_LINE_HEIGHT = 20;
const VOTE_TEXT_Y = CARD_TOP_Y + CARD_HEIGHT + 10;
const RANDOM_LABEL = 'Random';

const READY_COLOR = '#ffdc28';

// Each status is split across lines short enough to fit inside CARD_WIDTH with margin to spare.
const STATUS_LABEL = {
  unjoined: ['Press jump', 'to join'],
  joined: ['Press jump', 'when ready'],
  ready: ['READY!'],
};

export class PlayerSelectScene {
  constructor({ sceneManager, levels, seed = Date.now() } = {}) {
    this.sceneManager = sceneManager;
    this.levels = levels;
    this.seed = seed;
    this.waterLineY = NO_WATER_LINE_Y;
    this.backgroundDrawn = false;
    // Captured from the real input on the first tick this scene runs, so a button still held from
    // the title screen's confirm press never counts as a fresh press here.
    this.previousInput = null;
    this.stateByPlayerId = {};
    // A vote is an index into levels, or levels.length for Random.
    this.voteByPlayerId = {};
    for (const spawn of PLAYERS) {
      this.stateByPlayerId[spawn.id] = 'unjoined';
      this.voteByPlayerId[spawn.id] = levels.length;
    }
  }

  update(inputByPlayerId) {
    if (!this.previousInput) {
      this.previousInput = {};
      for (const spawn of PLAYERS) this.previousInput[spawn.id] = { ...inputByPlayerId[spawn.id] };
      return;
    }

    for (const spawn of PLAYERS) {
      const input = inputByPlayerId[spawn.id] ?? {};
      const previous = this.previousInput[spawn.id];
      if (this.stateByPlayerId[spawn.id] === 'joined') {
        if (input.left && !previous.left) this.changeVote(spawn.id, -1);
        if (input.right && !previous.right) this.changeVote(spawn.id, 1);
      }
      if (input.jump && !previous.jump) this.advance(spawn.id);
      this.previousInput[spawn.id] = { ...input };
    }

    if (Object.values(this.stateByPlayerId).every((state) => state === 'ready')) {
      this.sceneManager.setScene(
        new PausableMatchScene({
          sceneManager: this.sceneManager,
          matchScene: new VersusScene({ level: this.pickLevel(), seed: this.seed }),
        }),
      );
    }
  }

  advance(playerId) {
    const state = this.stateByPlayerId[playerId];
    if (state === 'unjoined') this.stateByPlayerId[playerId] = 'joined';
    else if (state === 'joined') this.stateByPlayerId[playerId] = 'ready';
  }

  changeVote(playerId, direction) {
    const optionCount = this.levels.length + 1;
    this.voteByPlayerId[playerId] = (this.voteByPlayerId[playerId] + direction + optionCount) % optionCount;
  }

  // Every vote for a level is one ticket for it, and a Random vote is one ticket for every level.
  pickLevel() {
    const tickets = [];
    for (const vote of Object.values(this.voteByPlayerId)) {
      if (vote < this.levels.length) tickets.push(this.levels[vote]);
      else tickets.push(...this.levels);
    }
    return tickets[Math.floor(new SeededRandom(this.seed).next() * tickets.length)];
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
  context.fillStyle = MENU_BACKGROUND_COLOR;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
}

function drawPlayerCard(context, spawn, state, voteLabel) {
  const columnIndex = PLAYERS.indexOf(spawn);
  const centerX = SCREEN_WIDTH / 2 + (columnIndex === 0 ? -CARD_OFFSET_X : CARD_OFFSET_X);
  const cardX = Math.round(centerX - CARD_WIDTH / 2);

  context.strokeStyle = spawn.color;
  context.lineWidth = 2;
  context.strokeRect(cardX + 1, CARD_TOP_Y + 1, CARD_WIDTH - 2, CARD_HEIGHT - 2);

  drawText(context, `${spawn.id[0].toUpperCase()}${spawn.id.slice(1)}`, centerX, CARD_LABEL_Y, {
    align: 'center',
    color: spawn.color,
  });

  if (state !== 'unjoined') drawPlayerPortrait(context, spawn, columnIndex, centerX, PORTRAIT_TOP_Y);

  if (state !== 'unjoined') {
    drawText(context, state === 'joined' ? `< ${voteLabel} >` : voteLabel, centerX, VOTE_TEXT_Y, {
      align: 'center',
      color: spawn.color,
    });
  }

  drawStatus(context, STATUS_LABEL[state], centerX, state === 'ready' ? READY_COLOR : spawn.color);
}

// Centers a single line in the two-line status slot, so READY! sits level with a wrapped status.
function drawStatus(context, lines, centerX, color) {
  const topY = lines.length === 1 ? STATUS_TEXT_TOP_Y + STATUS_LINE_HEIGHT / 2 : STATUS_TEXT_TOP_Y;
  lines.forEach((line, index) => {
    drawText(context, line, centerX, topY + index * STATUS_LINE_HEIGHT, { align: 'center', color });
  });
}

// Reuses the player's own in-game drawing, magnified so it reads clearly on the card.
function drawPlayerPortrait(context, spawn, columnIndex, centerX, topY) {
  const player = new Player({ ...spawn, spawnX: 0, spawnY: 0, facing: columnIndex === 0 ? 1 : -1 });
  player.y = 0;
  context.save();
  context.translate(Math.round(centerX - (player.width * PORTRAIT_SCALE) / 2), Math.round(topY));
  context.scale(PORTRAIT_SCALE, PORTRAIT_SCALE);
  player.renderAt(context, 0);
  context.restore();
}

function drawPlayerSelectUi(context, scene) {
  drawText(context, 'Player Select', SCREEN_WIDTH / 2, TITLE_Y, { scale: TITLE_SCALE, align: 'center' });

  for (const spawn of PLAYERS) {
    const vote = scene.voteByPlayerId[spawn.id];
    const voteLabel = vote < scene.levels.length ? scene.levels[vote].name : RANDOM_LABEL;
    drawPlayerCard(context, spawn, scene.stateByPlayerId[spawn.id], voteLabel);
  }
}
