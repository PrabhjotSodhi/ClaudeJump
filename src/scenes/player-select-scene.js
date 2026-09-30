import { SCREEN_HEIGHT, SCREEN_WIDTH, TICK_RATE } from '../engine/config.js';
import { EventEmitter } from '../engine/events.js';
import { CHARACTERS, HOVER_CHARACTER_BY_PLAYER_ID } from '../entities/characters.js';
import { PLAYERS } from '../levels/versus-arena.js';
import {
  drawKeyHintPanel,
  drawMenuTitle,
  drawWithMenuMotion,
  MenuMotion,
  rowIndexAt,
  tapPoint,
} from '../ui/menu-kit.js';
import { MENU_BACKGROUND_COLOR, NO_WATER_LINE_Y } from '../ui/menu-screen.js';
import { drawPanel } from '../ui/panel.js';
import { SelectCardMotion } from '../ui/select-card-motion.js';
import { drawText, measureText } from '../ui/text.js';
import { drawCharacterBody, FRAME_SIZE } from '../vfx/character-body.js';
import { EYE_STIFFNESSES, GooglyEye } from '../vfx/googly-eyes.js';
import { LevelSelectScene } from './level-select-scene.js';

const TITLE_Y = 24;

const CARD_TOP_Y = 44;
const CARD_WIDTH = 148;
const CARD_HEIGHT = 144;
const CARD_GAP = 8;
const CARD_LABEL_Y = CARD_TOP_Y + 12;
const CARD_FRAME_INSET = 3;

const PEDESTAL_BLOCK_SIZE = 32;
const PEDESTAL_BLOCKS = 2;
const PEDESTAL_TOP_Y = CARD_TOP_Y + 72;
// The white outline row of the body overlaps the top edge of the pedestal so the feet read as touching.
const CHARACTER_SINK_PIXELS = 1;

const CHIP_WIDTH = 132;
const CHIP_HEIGHT = 24;
const CHIP_TOP_Y = CARD_TOP_Y + 112;
const TEXT_HEIGHT = 5;
const ARROW_DEPTH = 3;
const ARROW_GAP = 6;

// The roster fills rows of this many heads, each row centered under its card.
const ROSTER_HEADS_PER_ROW = 4;
const ROSTER_TOP_Y = CARD_TOP_Y + CARD_HEIGHT + 8;
const HEAD_SIZE = 24;
const HEAD_OUTER_SIZE = HEAD_SIZE + 2;
const HEAD_GAP = 4;
const ROSTER_ROWS = Math.ceil(CHARACTERS.length / ROSTER_HEADS_PER_ROW);
const ROSTER_BOTTOM_Y = ROSTER_TOP_Y + ROSTER_ROWS * HEAD_OUTER_SIZE + (ROSTER_ROWS - 1) * HEAD_GAP;
// The sprite frame hangs this many rows below the tile's bottom edge, so the tile shows head and shoulders.
const HEAD_CROP_ROWS = 8;
const HEAD_BORDER_COLOR = '#181425';
const HEAD_FILL_COLOR = '#3a4466';

const SELECTED_COLOR = '#feae34';
const UNJOINED_COLOR = '#c0cbdc';

const HINTS_PANEL_WIDTH = 360;
const HINTS_PANEL_TOP_Y = ROSTER_BOTTOM_Y + 12;
const KEY_HINT_ROWS = [
  {
    label: 'Red',
    device: 'keyboard',
    color: PLAYERS.find((spawn) => spawn.id === 'red').color,
    hints: [
      {
        keys: [
          { player: 'red', control: 'left' },
          { player: 'red', control: 'right' },
        ],
        label: 'Pick',
      },
      { keys: [{ player: 'red', control: 'jump' }], label: 'Join or lock in' },
      { keys: [{ player: 'red', control: 'action' }], label: 'Back' },
    ],
  },
  {
    label: 'Blue',
    device: 'keyboard',
    color: PLAYERS.find((spawn) => spawn.id === 'blue').color,
    hints: [
      {
        keys: [
          { player: 'blue', control: 'left' },
          { player: 'blue', control: 'right' },
        ],
        label: 'Pick',
      },
      { keys: [{ player: 'blue', control: 'jump' }], label: 'Join or lock in' },
      { keys: [{ player: 'blue', control: 'action' }], label: 'Back' },
    ],
  },
  {
    label: 'Pads',
    device: 'pad',
    color: UNJOINED_COLOR,
    hints: [
      { keys: ['Stick'], pad: ['stick'], label: 'Pick' },
      { keys: ['A'], pad: ['south'], label: 'Join or lock in' },
      { keys: ['Down'], pad: ['east'], label: 'Back' },
    ],
  },
];

// Green and yellow have no keyboard keys, so their cards name the pad to press.
const JOIN_TEXT_BY_PLAYER_ID = {
  red: 'Press jump to join',
  blue: 'Press jump to join',
  green: 'Press jump on pad 3',
  yellow: 'Press jump on pad 4',
};

// Each card goes through these states in order, one jump press apart.
const NEXT_STATE = { unjoined: 'picking', picking: 'ready' };

const MINIMUM_PLAYERS = 2;

// Once everyone who joined is ready, this many ticks pass before the match starts, so a player still reaching for
// their pad can join. A join or an un-ready cancels it.
export const START_COUNTDOWN_TICKS = 120;
const COUNTDOWN_Y = 336;

// The card's rectangle. Four cards sit side by side and stay in seat order whether or not anyone has joined.
export function playerCardBox(seatIndex) {
  const totalWidth = PLAYERS.length * CARD_WIDTH + (PLAYERS.length - 1) * CARD_GAP;
  return {
    x: (SCREEN_WIDTH - totalWidth) / 2 + seatIndex * (CARD_WIDTH + CARD_GAP),
    y: CARD_TOP_Y,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  };
}

// Every card shows the same eyes at rest.
const PORTRAIT_EYES = EYE_STIFFNESSES.map((stiffness) => new GooglyEye(stiffness));

export class PlayerSelectScene {
  constructor({ sceneManager, levels, sprites = {}, seed = Date.now() } = {}) {
    this.sceneManager = sceneManager;
    this.events = new EventEmitter();
    this.musicTrackName = 'menu';
    this.levels = levels;
    this.sprites = sprites;
    this.seed = seed;
    this.waterLineY = NO_WATER_LINE_Y;
    this.menuMotion = new MenuMotion();
    this.backgroundDrawn = false;
    // Captured from the real input on the first tick this scene runs, so a button still held from
    // the title screen's confirm press never counts as a fresh press here.
    this.previousInput = null;
    // Render only: hops, cheers and slide-ins of the cards.
    this.cardMotion = new SelectCardMotion();
    this.countdownTicksRemaining = null;
    this.stateByPlayerId = {};
    // An index into CHARACTERS: the hovered character until the player locks it in, then the chosen one.
    this.characterIndexByPlayerId = {};
    for (const spawn of PLAYERS) {
      this.stateByPlayerId[spawn.id] = 'unjoined';
      this.characterIndexByPlayerId[spawn.id] = CHARACTERS.indexOf(HOVER_CHARACTER_BY_PLAYER_ID[spawn.id]);
    }
  }

  update(inputByPlayerId) {
    this.cardMotion.update();
    this.menuMotion.update();
    if (!this.previousInput) {
      this.previousInput = {};
      for (const spawn of PLAYERS) this.previousInput[spawn.id] = { ...inputByPlayerId[spawn.id] };
      return;
    }

    for (const spawn of PLAYERS) {
      const input = inputByPlayerId[spawn.id] ?? {};
      const previous = this.previousInput[spawn.id];
      if (this.stateByPlayerId[spawn.id] === 'picking') {
        if (input.left && !previous.left) this.changeCharacter(spawn.id, -1);
        if (input.right && !previous.right) this.changeCharacter(spawn.id, 1);
      }
      if (input.jump && !previous.jump) this.advance(spawn.id);
      else if (input.down && !previous.down) this.stepBack(spawn.id);
      this.previousInput[spawn.id] = { ...input };
    }

    this.advanceTappedCard(inputByPlayerId);

    if (!this.everyoneJoinedIsReady()) {
      this.countdownTicksRemaining = null;
    } else {
      this.countdownTicksRemaining = (this.countdownTicksRemaining ?? START_COUNTDOWN_TICKS) - 1;
    }
    if (this.countdownTicksRemaining === 0) {
      this.sceneManager.setScene(
        new LevelSelectScene({
          sceneManager: this.sceneManager,
          levels: this.levels,
          characterByPlayerId: this.pickedCharacters(),
          sprites: this.sprites,
          seed: this.seed,
        }),
      );
    }
  }

  // The match starts once at least two players are ready and nobody who joined is still picking.
  // Players who never joined take no part.
  everyoneJoinedIsReady() {
    const states = Object.values(this.stateByPlayerId);
    const readyCount = states.filter((state) => state === 'ready').length;
    return readyCount >= MINIMUM_PLAYERS && states.every((state) => state !== 'picking');
  }

  // Touch drives the first player. A tap on their card joins, then locks in.
  advanceTappedCard(inputByPlayerId) {
    if (rowIndexAt([playerCardBox(0)], tapPoint(inputByPlayerId)) === 0) this.advance(PLAYERS[0].id);
  }

  // Down steps back: a ready player goes back to picking, and a player who joined by mistake steps out,
  // so nobody holds the others up.
  stepBack(playerId) {
    const previousState = { picking: 'unjoined', ready: 'picking' }[this.stateByPlayerId[playerId]];
    if (!previousState) return;
    this.stateByPlayerId[playerId] = previousState;
    this.events.emit('menu-moved', { playerId });
  }

  advance(playerId) {
    const state = this.stateByPlayerId[playerId];
    if (!(state in NEXT_STATE)) return;
    this.stateByPlayerId[playerId] = NEXT_STATE[state];
    this.events.emit('menu-selected', { playerId });
    const seatIndex = PLAYERS.findIndex((spawn) => spawn.id === playerId);
    if (this.stateByPlayerId[playerId] === 'picking') this.cardMotion.join(seatIndex);
    if (this.stateByPlayerId[playerId] === 'ready') {
      this.cardMotion.cheer(seatIndex);
      this.events.emit('character-cheered', {
        playerId,
        characterName: CHARACTERS[this.characterIndexByPlayerId[playerId]].name,
      });
      this.moveHoveringPlayersOff(playerId);
    }
  }

  isLockedByOther(playerId, characterIndex) {
    return PLAYERS.some(
      (spawn) =>
        spawn.id !== playerId &&
        this.stateByPlayerId[spawn.id] === 'ready' &&
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
    this.cardMotion.hop(PLAYERS.findIndex((spawn) => spawn.id === playerId));
    this.events.emit('menu-moved', { playerId });
  }

  // Anyone still hovering on the character that was just locked in moves on to the next free one.
  moveHoveringPlayersOff(lockedPlayerId) {
    for (const spawn of PLAYERS) {
      if (spawn.id === lockedPlayerId || this.stateByPlayerId[spawn.id] === 'ready') continue;
      if (this.characterIndexByPlayerId[spawn.id] === this.characterIndexByPlayerId[lockedPlayerId]) {
        this.changeCharacter(spawn.id, 1);
      }
    }
  }

  // Only the ready players, in seat order.
  pickedCharacters() {
    const characterByPlayerId = {};
    for (const spawn of PLAYERS) {
      if (this.stateByPlayerId[spawn.id] === 'ready')
        characterByPlayerId[spawn.id] = CHARACTERS[this.characterIndexByPlayerId[spawn.id]];
    }
    return characterByPlayerId;
  }

  render(renderer) {
    if (!this.backgroundDrawn) {
      renderer.updateBackground((context) => drawPlayerSelectBackground(context));
      this.backgroundDrawn = true;
    }

    renderer.clearGameLayer();
    renderer.clearUiLayer();
    drawWithMenuMotion(renderer.uiContext, this.menuMotion, () => drawPlayerSelectUi(renderer.uiContext, this));
  }
}

function drawPlayerSelectBackground(context) {
  context.fillStyle = MENU_BACKGROUND_COLOR;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
}

function drawFrame(context, x, y, width, height, color) {
  context.fillStyle = color;
  context.fillRect(x, y, width, 1);
  context.fillRect(x, y + height - 1, width, 1);
  context.fillRect(x, y + 1, 1, height - 2);
  context.fillRect(x + width - 1, y + 1, 1, height - 2);
}

function drawPlayerCard(context, scene, spawn) {
  const state = scene.stateByPlayerId[spawn.id];
  const character = CHARACTERS[scene.characterIndexByPlayerId[spawn.id]];
  const seatIndex = PLAYERS.indexOf(spawn);
  const cardBox = playerCardBox(seatIndex);
  const cardX = cardBox.x;
  const centerX = cardX + CARD_WIDTH / 2;
  context.save();
  context.translate(scene.cardMotion.slideOffsetX(seatIndex, cardBox), 0);

  drawPanel(context, cardX, CARD_TOP_Y, CARD_WIDTH, CARD_HEIGHT);
  drawFrame(
    context,
    cardX + CARD_FRAME_INSET,
    CARD_TOP_Y + CARD_FRAME_INSET,
    CARD_WIDTH - 2 * CARD_FRAME_INSET,
    CARD_HEIGHT - 2 * CARD_FRAME_INSET,
    spawn.color,
  );
  drawText(context, `${spawn.id[0].toUpperCase()}${spawn.id.slice(1)}`, centerX, CARD_LABEL_Y, {
    scale: 1,
    align: 'center',
    color: spawn.color,
    outlineColor: null,
  });

  for (let block = 0; block < PEDESTAL_BLOCKS; block++) {
    const blockX = centerX - (PEDESTAL_BLOCKS * PEDESTAL_BLOCK_SIZE) / 2 + block * PEDESTAL_BLOCK_SIZE;
    context.drawImage(scene.sprites.stoneBlocks[`block-big-${block % 2}`], blockX, PEDESTAL_TOP_Y);
  }
  if (state !== 'unjoined') {
    const pose = scene.cardMotion.pose(seatIndex);
    const bottomY = PEDESTAL_TOP_Y + CHARACTER_SINK_PIXELS - pose.offsetY;
    drawCharacter(context, character, scene.sprites, centerX, bottomY, pose);
  }

  drawChip(context, state, character, centerX, JOIN_TEXT_BY_PLAYER_ID[spawn.id]);
  drawRoster(context, scene, spawn, centerX);
  context.restore();
}

function drawCharacter(
  context,
  character,
  sprites,
  centerX,
  bottomY,
  size = { width: FRAME_SIZE, height: FRAME_SIZE },
) {
  drawCharacterBody(context, {
    sprite: sprites[character.spriteName].body,
    eyeFramePositions: character.eyeFramePositions,
    eyes: PORTRAIT_EYES,
    centerX,
    bottomY,
    width: size.width,
    height: size.height,
  });
}

// The chip reads the state: how to join, then the pickable name between arrows, then READY!.
function drawChip(context, state, character, centerX, joinText) {
  drawPanel(context, centerX - CHIP_WIDTH / 2, CHIP_TOP_Y, CHIP_WIDTH, CHIP_HEIGHT);
  const textY = CHIP_TOP_Y + Math.floor((CHIP_HEIGHT - TEXT_HEIGHT) / 2);
  const text = { unjoined: joinText, picking: character.displayName, ready: 'READY!' }[state];
  const color = { unjoined: UNJOINED_COLOR, picking: character.tagColor, ready: SELECTED_COLOR }[state];
  drawText(context, text, centerX, textY, { scale: 1, align: 'center', color, outlineColor: null });
  if (state === 'picking') drawArrows(context, centerX, measureText(text), textY, color);
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

// One small head per character under the card, the current pick outlined once the player has joined.
function drawRoster(context, scene, spawn, centerX) {
  const joined = scene.stateByPlayerId[spawn.id] !== 'unjoined';
  CHARACTERS.forEach((character, index) => {
    const row = Math.floor(index / ROSTER_HEADS_PER_ROW);
    const headsInRow = Math.min(ROSTER_HEADS_PER_ROW, CHARACTERS.length - row * ROSTER_HEADS_PER_ROW);
    const rowWidth = headsInRow * HEAD_OUTER_SIZE + (headsInRow - 1) * HEAD_GAP;
    const x = centerX - rowWidth / 2 + (index % ROSTER_HEADS_PER_ROW) * (HEAD_OUTER_SIZE + HEAD_GAP);
    const y = ROSTER_TOP_Y + row * (HEAD_OUTER_SIZE + HEAD_GAP);
    const isPick = joined && index === scene.characterIndexByPlayerId[spawn.id];
    context.fillStyle = isPick ? SELECTED_COLOR : HEAD_BORDER_COLOR;
    context.fillRect(x, y, HEAD_OUTER_SIZE, HEAD_OUTER_SIZE);
    context.fillStyle = HEAD_FILL_COLOR;
    context.fillRect(x + 1, y + 1, HEAD_SIZE, HEAD_SIZE);
    context.save();
    context.beginPath();
    context.rect(x + 1, y + 1, HEAD_SIZE, HEAD_SIZE);
    context.clip();
    drawCharacter(context, character, scene.sprites, x + 1 + HEAD_SIZE / 2, y + 1 + HEAD_SIZE + HEAD_CROP_ROWS);
    context.restore();
  });
}

function drawPlayerSelectUi(context, scene) {
  drawMenuTitle(context, 'Player Select', TITLE_Y);
  for (const spawn of PLAYERS) drawPlayerCard(context, scene, spawn);
  drawKeyHintPanel(context, KEY_HINT_ROWS, { topY: HINTS_PANEL_TOP_Y, width: HINTS_PANEL_WIDTH });
  if (scene.countdownTicksRemaining !== null) {
    drawText(
      context,
      `Starting in ${Math.ceil(scene.countdownTicksRemaining / TICK_RATE)}`,
      SCREEN_WIDTH / 2,
      COUNTDOWN_Y,
      { scale: 2, align: 'center', color: SELECTED_COLOR },
    );
  }
}
