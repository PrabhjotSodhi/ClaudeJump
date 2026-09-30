import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { EventEmitter } from '../engine/events.js';
import { CHARACTERS, DEFAULT_CHARACTER_BY_PLAYER_ID } from '../entities/characters.js';
import { PLAYERS } from '../levels/versus-arena.js';
import { drawKeyHints, drawMenuTitle, KEYCAP_HEIGHT, rowIndexAt, tapPoint } from '../ui/menu-kit.js';
import { MENU_BACKGROUND_COLOR, NO_WATER_LINE_Y } from '../ui/menu-screen.js';
import { drawPanel } from '../ui/panel.js';
import { drawText, measureText } from '../ui/text.js';
import { drawCharacterBody, FRAME_SIZE } from '../vfx/character-body.js';
import { EYE_STIFFNESSES, GooglyEye } from '../vfx/googly-eyes.js';
import { LevelSelectScene } from './level-select-scene.js';

const TITLE_Y = 24;

const CARD_TOP_Y = 56;
const CARD_WIDTH = 280;
const CARD_HEIGHT = 172;
const CARD_OFFSET_X = 145;
const CARD_LABEL_Y = CARD_TOP_Y + 12;
const CARD_FRAME_INSET = 3;

const PEDESTAL_BLOCK_SIZE = 32;
const PEDESTAL_BLOCKS = 2;
const PEDESTAL_TOP_Y = CARD_TOP_Y + 92;
// The white outline row of the body overlaps the top edge of the pedestal so the feet read as touching.
const CHARACTER_SINK_PIXELS = 1;
const HOP_TICKS = 24;
const HOP_HEIGHT = 10;

const CHIP_WIDTH = 176;
const CHIP_HEIGHT = 24;
const CHIP_TOP_Y = CARD_TOP_Y + 136;
const TEXT_HEIGHT = 5;
const ARROW_DEPTH = 3;
const ARROW_GAP = 6;

const ROSTER_TOP_Y = CARD_TOP_Y + CARD_HEIGHT + 12;
const HEAD_SIZE = 24;
const HEAD_OUTER_SIZE = HEAD_SIZE + 2;
const HEAD_GAP = 4;
// The sprite frame hangs this many rows below the tile's bottom edge, so the tile shows head and shoulders.
const HEAD_CROP_ROWS = 8;
const HEAD_BORDER_COLOR = '#181425';
const HEAD_FILL_COLOR = '#3a4466';

const SELECTED_COLOR = '#feae34';
const UNJOINED_COLOR = '#c0cbdc';

const HINTS_PANEL_WIDTH = 300;
const HINTS_PANEL_TOP_Y = ROSTER_TOP_Y + HEAD_OUTER_SIZE + 16;
const HINTS_PANEL_PADDING = 8;
const HINTS_ROW_HEIGHT = 14;
const KEY_HINT_ROWS = [
  {
    label: 'Red',
    color: PLAYERS.find((spawn) => spawn.id === 'red').color,
    hints: [
      { keys: ['A', 'D'], label: 'Pick' },
      { keys: ['W'], label: 'Join or lock in' },
    ],
  },
  {
    label: 'Blue',
    color: PLAYERS.find((spawn) => spawn.id === 'blue').color,
    hints: [
      { keys: ['Left', 'Right'], label: 'Pick' },
      { keys: ['Up'], label: 'Join or lock in' },
    ],
  },
  {
    label: 'Pad',
    color: UNJOINED_COLOR,
    hints: [
      { keys: ['Stick'], label: 'Pick' },
      { keys: ['A'], label: 'Join or lock in' },
    ],
  },
];

const CHIP_TEXT = { unjoined: 'Press jump to join', ready: 'READY!' };

// Each card goes through these states in order, one jump press apart.
const NEXT_STATE = { unjoined: 'picking', picking: 'ready' };

// How many pixels above the pedestal a character is this many ticks after a hop starts: a parabola that
// leaves the pedestal at 0, peaks at HOP_HEIGHT and lands at HOP_TICKS.
export function hopOffsetY(ticksSinceHop) {
  if (ticksSinceHop < 0 || ticksSinceHop >= HOP_TICKS) return 0;
  return Math.round((HOP_HEIGHT * 4 * ticksSinceHop * (HOP_TICKS - ticksSinceHop)) / (HOP_TICKS * HOP_TICKS));
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
    this.backgroundDrawn = false;
    // Captured from the real input on the first tick this scene runs, so a button still held from
    // the title screen's confirm press never counts as a fresh press here.
    this.previousInput = null;
    // Render only: when each player's character last changed, so the card can hop it.
    this.tickCount = 0;
    this.hopStartTickByPlayerId = {};
    this.stateByPlayerId = {};
    // An index into CHARACTERS: the hovered character until the player locks it in, then the chosen one.
    this.characterIndexByPlayerId = {};
    for (const spawn of PLAYERS) {
      this.stateByPlayerId[spawn.id] = 'unjoined';
      this.characterIndexByPlayerId[spawn.id] = CHARACTERS.indexOf(DEFAULT_CHARACTER_BY_PLAYER_ID[spawn.id]);
    }
  }

  update(inputByPlayerId) {
    this.tickCount++;
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
      this.previousInput[spawn.id] = { ...input };
    }

    this.advanceTappedCard(inputByPlayerId);

    if (Object.values(this.stateByPlayerId).every((state) => state === 'ready')) {
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

  // Touch drives the first player. A tap on their card joins, then locks in.
  advanceTappedCard(inputByPlayerId) {
    const cardX = SCREEN_WIDTH / 2 - CARD_OFFSET_X - CARD_WIDTH / 2;
    const card = { x: cardX, y: CARD_TOP_Y, width: CARD_WIDTH, height: CARD_HEIGHT };
    if (rowIndexAt([card], tapPoint(inputByPlayerId)) === 0) this.advance(PLAYERS[0].id);
  }

  advance(playerId) {
    const state = this.stateByPlayerId[playerId];
    if (!(state in NEXT_STATE)) return;
    this.stateByPlayerId[playerId] = NEXT_STATE[state];
    this.events.emit('menu-selected', { playerId });
    if (this.stateByPlayerId[playerId] === 'ready') {
      this.hopStartTickByPlayerId[playerId] = this.tickCount;
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
    this.hopStartTickByPlayerId[playerId] = this.tickCount;
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

  pickedCharacters() {
    const characterByPlayerId = {};
    for (const spawn of PLAYERS) characterByPlayerId[spawn.id] = CHARACTERS[this.characterIndexByPlayerId[spawn.id]];
    return characterByPlayerId;
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
  const centerX = SCREEN_WIDTH / 2 + (PLAYERS.indexOf(spawn) === 0 ? -CARD_OFFSET_X : CARD_OFFSET_X);
  const cardX = centerX - CARD_WIDTH / 2;

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
    const hopY = hopOffsetY(scene.tickCount - (scene.hopStartTickByPlayerId[spawn.id] ?? -HOP_TICKS));
    drawCharacter(context, character, scene.sprites, centerX, PEDESTAL_TOP_Y + CHARACTER_SINK_PIXELS - hopY);
  }

  drawChip(context, state, character, centerX);
  drawRoster(context, scene, spawn, centerX);
}

function drawCharacter(context, character, sprites, centerX, bottomY) {
  drawCharacterBody(context, {
    sprite: sprites[character.spriteName].body,
    eyeFramePositions: character.eyeFramePositions,
    eyes: PORTRAIT_EYES,
    centerX,
    bottomY,
    width: FRAME_SIZE,
    height: FRAME_SIZE,
  });
}

// The chip reads the state: how to join, then the pickable name between arrows, then READY!.
function drawChip(context, state, character, centerX) {
  drawPanel(context, centerX - CHIP_WIDTH / 2, CHIP_TOP_Y, CHIP_WIDTH, CHIP_HEIGHT);
  const textY = CHIP_TOP_Y + Math.floor((CHIP_HEIGHT - TEXT_HEIGHT) / 2);
  const text = state === 'picking' ? character.displayName : CHIP_TEXT[state];
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
  const rosterWidth = CHARACTERS.length * HEAD_OUTER_SIZE + (CHARACTERS.length - 1) * HEAD_GAP;
  const leftX = centerX - rosterWidth / 2;
  const joined = scene.stateByPlayerId[spawn.id] !== 'unjoined';
  CHARACTERS.forEach((character, index) => {
    const x = leftX + index * (HEAD_OUTER_SIZE + HEAD_GAP);
    const isPick = joined && index === scene.characterIndexByPlayerId[spawn.id];
    context.fillStyle = isPick ? SELECTED_COLOR : HEAD_BORDER_COLOR;
    context.fillRect(x, ROSTER_TOP_Y, HEAD_OUTER_SIZE, HEAD_OUTER_SIZE);
    context.fillStyle = HEAD_FILL_COLOR;
    context.fillRect(x + 1, ROSTER_TOP_Y + 1, HEAD_SIZE, HEAD_SIZE);
    context.save();
    context.beginPath();
    context.rect(x + 1, ROSTER_TOP_Y + 1, HEAD_SIZE, HEAD_SIZE);
    context.clip();
    drawCharacter(
      context,
      character,
      scene.sprites,
      x + 1 + HEAD_SIZE / 2,
      ROSTER_TOP_Y + 1 + HEAD_SIZE + HEAD_CROP_ROWS,
    );
    context.restore();
  });
}

function drawKeyHintPanel(context) {
  const height = (KEY_HINT_ROWS.length - 1) * HINTS_ROW_HEIGHT + KEYCAP_HEIGHT + 2 * HINTS_PANEL_PADDING;
  const left = (SCREEN_WIDTH - HINTS_PANEL_WIDTH) / 2;
  drawPanel(context, left, HINTS_PANEL_TOP_Y, HINTS_PANEL_WIDTH, height);
  KEY_HINT_ROWS.forEach(({ label, color, hints }, index) => {
    const y = HINTS_PANEL_TOP_Y + HINTS_PANEL_PADDING + index * HINTS_ROW_HEIGHT;
    drawText(context, label, left + HINTS_PANEL_PADDING, y + 3, { scale: 1, color, outlineColor: null });
    drawKeyHints(context, hints, y);
  });
}

function drawPlayerSelectUi(context, scene) {
  drawMenuTitle(context, 'Player Select', TITLE_Y);
  for (const spawn of PLAYERS) drawPlayerCard(context, scene, spawn);
  drawKeyHintPanel(context);
}
