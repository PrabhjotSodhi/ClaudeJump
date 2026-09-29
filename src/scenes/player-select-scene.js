import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { SeededRandom } from '../engine/seeded-random.js';
import { CHARACTERS, DEFAULT_CHARACTER_BY_PLAYER_ID } from '../entities/characters.js';
import { PLAYERS } from '../levels/versus-arena.js';
import { MENU_BACKGROUND_COLOR, NO_WATER_LINE_Y } from '../ui/menu-screen.js';
import { drawText, measureText } from '../ui/text.js';
import { drawCharacterBody, FRAME_SIZE } from '../vfx/character-body.js';
import { EYE_STIFFNESSES, GooglyEye } from '../vfx/googly-eyes.js';
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
const PORTRAIT_TOP_Y = CARD_TOP_Y + 34;
const CHARACTER_NAME_Y = PORTRAIT_TOP_Y + FRAME_SIZE * PORTRAIT_SCALE + 8;
// The status sits in the last two text rows above the card's bottom edge, so both a wrapped
// two-line status and the single-line READY! stay inside the card with room to spare.
const STATUS_TEXT_TOP_Y = CARD_TOP_Y + CARD_HEIGHT - 46;
const STATUS_LINE_HEIGHT = 20;
const VOTE_TEXT_Y = CARD_TOP_Y + CARD_HEIGHT + 10;
const TEXT_SCALE = 2;
// Each arrow is a triangle this many pixels deep and twice that minus one tall, about the height of the text.
const ARROW_DEPTH = 5;
const ARROW_GAP = 8;
const RANDOM_LABEL = 'Random';

const READY_COLOR = '#ffdc28';

// Each status is split across lines short enough to fit inside CARD_WIDTH with margin to spare.
const STATUS_LABEL = {
  unjoined: ['Press jump', 'to join'],
  picking: ['Press jump', 'to lock in'],
  voting: ['Press jump', 'when ready'],
  ready: ['READY!'],
};

// Each card goes through these states in order, one jump press apart.
const NEXT_STATE = { unjoined: 'picking', picking: 'voting', voting: 'ready' };
const LOCKED_STATES = ['voting', 'ready'];

// Every card shows the same eyes at rest.
const PORTRAIT_EYES = EYE_STIFFNESSES.map((stiffness) => new GooglyEye(stiffness));

export class PlayerSelectScene {
  constructor({ sceneManager, levels, sprites = {}, seed = Date.now() } = {}) {
    this.sceneManager = sceneManager;
    this.levels = levels;
    this.sprites = sprites;
    this.seed = seed;
    this.waterLineY = NO_WATER_LINE_Y;
    this.backgroundDrawn = false;
    // Captured from the real input on the first tick this scene runs, so a button still held from
    // the title screen's confirm press never counts as a fresh press here.
    this.previousInput = null;
    this.stateByPlayerId = {};
    // A vote is an index into levels, or levels.length for Random.
    this.voteByPlayerId = {};
    // An index into CHARACTERS: the hovered character until the player locks it in, then the chosen one.
    this.characterIndexByPlayerId = {};
    for (const spawn of PLAYERS) {
      this.stateByPlayerId[spawn.id] = 'unjoined';
      this.characterIndexByPlayerId[spawn.id] = CHARACTERS.indexOf(DEFAULT_CHARACTER_BY_PLAYER_ID[spawn.id]);
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
      const state = this.stateByPlayerId[spawn.id];
      if (state === 'picking' || state === 'voting') {
        const change = (direction) =>
          state === 'picking' ? this.changeCharacter(spawn.id, direction) : this.changeVote(spawn.id, direction);
        if (input.left && !previous.left) change(-1);
        if (input.right && !previous.right) change(1);
      }
      if (input.jump && !previous.jump) this.advance(spawn.id);
      this.previousInput[spawn.id] = { ...input };
    }

    if (Object.values(this.stateByPlayerId).every((state) => state === 'ready')) {
      this.sceneManager.setScene(
        new PausableMatchScene({
          sceneManager: this.sceneManager,
          matchScene: new VersusScene({
            level: this.pickLevel(),
            seed: this.seed,
            characterByPlayerId: this.pickedCharacters(),
            sprites: this.sprites,
            levels: this.levels,
          }),
        }),
      );
    }
  }

  advance(playerId) {
    const state = this.stateByPlayerId[playerId];
    if (!(state in NEXT_STATE)) return;
    this.stateByPlayerId[playerId] = NEXT_STATE[state];
    if (this.stateByPlayerId[playerId] === 'voting') this.moveHoveringPlayersOff(playerId);
  }

  isLockedByOther(playerId, characterIndex) {
    return PLAYERS.some(
      (spawn) =>
        spawn.id !== playerId &&
        LOCKED_STATES.includes(this.stateByPlayerId[spawn.id]) &&
        this.characterIndexByPlayerId[spawn.id] === characterIndex,
    );
  }

  // The next character in that direction that the other player has not locked in.
  nextFreeCharacterIndex(playerId, direction) {
    let index = this.characterIndexByPlayerId[playerId];
    do {
      index = (index + direction + CHARACTERS.length) % CHARACTERS.length;
    } while (this.isLockedByOther(playerId, index));
    return index;
  }

  changeCharacter(playerId, direction) {
    this.characterIndexByPlayerId[playerId] = this.nextFreeCharacterIndex(playerId, direction);
  }

  // Anyone still hovering on the character that was just locked in moves on to the next free one.
  moveHoveringPlayersOff(lockedPlayerId) {
    for (const spawn of PLAYERS) {
      if (spawn.id === lockedPlayerId || LOCKED_STATES.includes(this.stateByPlayerId[spawn.id])) continue;
      if (this.characterIndexByPlayerId[spawn.id] === this.characterIndexByPlayerId[lockedPlayerId]) {
        this.changeCharacter(spawn.id, 1);
      }
    }
  }

  pickedCharacters() {
    const characterByPlayerId = {};
    for (const spawn of PLAYERS) characterByPlayerId[spawn.id] = CHARACTERS[this.characterIndexByPlayerId[spawn.id]];
    return characterByPlayerId;
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

function drawPlayerCard(context, spawn, state, character, voteLabel, sprites) {
  const columnIndex = PLAYERS.indexOf(spawn);
  const centerX = SCREEN_WIDTH / 2 + (columnIndex === 0 ? -CARD_OFFSET_X : CARD_OFFSET_X);
  const cardX = Math.round(centerX - CARD_WIDTH / 2);
  const joined = state !== 'unjoined';
  const color = joined ? character.tagColor : spawn.color;

  context.strokeStyle = color;
  context.lineWidth = 2;
  context.strokeRect(cardX + 1, CARD_TOP_Y + 1, CARD_WIDTH - 2, CARD_HEIGHT - 2);

  drawText(context, `${spawn.id[0].toUpperCase()}${spawn.id.slice(1)}`, centerX, CARD_LABEL_Y, {
    align: 'center',
    color: spawn.color,
  });

  if (joined) {
    drawPortrait(context, character, sprites, centerX);
    drawText(context, character.displayName, centerX, CHARACTER_NAME_Y, { align: 'center', color });
  }
  if (state === 'picking') {
    drawArrows(context, centerX, measureText(character.displayName) * TEXT_SCALE, CHARACTER_NAME_Y, color);
  }

  if (state === 'voting' || state === 'ready') {
    drawText(context, voteLabel, centerX, VOTE_TEXT_Y, { scale: TEXT_SCALE, align: 'center', color });
  }
  if (state === 'voting') drawArrows(context, centerX, measureText(voteLabel) * TEXT_SCALE, VOTE_TEXT_Y, color);

  drawStatus(context, STATUS_LABEL[state], centerX, state === 'ready' ? READY_COLOR : color);
}

// Arrows either side of a line of text while it can still change, so players know left and right change it.
function drawArrows(context, centerX, labelWidth, topY, color) {
  const labelLeftX = centerX - Math.floor(labelWidth / 2);
  const leftArrowRightX = labelLeftX - ARROW_GAP;
  const rightArrowLeftX = labelLeftX + labelWidth + ARROW_GAP;
  context.fillStyle = color;
  for (let row = 0; row < ARROW_DEPTH * 2 - 1; row++) {
    const width = ARROW_DEPTH - Math.abs(row - (ARROW_DEPTH - 1));
    context.fillRect(leftArrowRightX - width, topY + row, width, 1);
    context.fillRect(rightArrowLeftX, topY + row, width, 1);
  }
}

// Centers a single line in the two-line status slot, so READY! sits level with a wrapped status.
function drawStatus(context, lines, centerX, color) {
  const topY = lines.length === 1 ? STATUS_TEXT_TOP_Y + STATUS_LINE_HEIGHT / 2 : STATUS_TEXT_TOP_Y;
  lines.forEach((line, index) => {
    drawText(context, line, centerX, topY + index * STATUS_LINE_HEIGHT, { align: 'center', color });
  });
}

// The same drawing a match uses, magnified so it reads clearly on the card.
function drawPortrait(context, character, sprites, centerX) {
  context.save();
  context.translate(Math.round(centerX), PORTRAIT_TOP_Y);
  context.scale(PORTRAIT_SCALE, PORTRAIT_SCALE);
  drawCharacterBody(context, {
    sprite: sprites[character.spriteName].body,
    eyeFramePositions: character.eyeFramePositions,
    eyes: PORTRAIT_EYES,
    centerX: 0,
    bottomY: FRAME_SIZE,
    width: FRAME_SIZE,
    height: FRAME_SIZE,
  });
  context.restore();
}

function drawPlayerSelectUi(context, scene) {
  drawText(context, 'Player Select', SCREEN_WIDTH / 2, TITLE_Y, { scale: TITLE_SCALE, align: 'center' });

  for (const spawn of PLAYERS) {
    const vote = scene.voteByPlayerId[spawn.id];
    const voteLabel = vote < scene.levels.length ? scene.levels[vote].name : RANDOM_LABEL;
    const character = CHARACTERS[scene.characterIndexByPlayerId[spawn.id]];
    drawPlayerCard(context, spawn, scene.stateByPlayerId[spawn.id], character, voteLabel, scene.sprites);
  }
}
