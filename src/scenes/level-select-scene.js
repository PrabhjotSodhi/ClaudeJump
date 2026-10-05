import { gameOptions } from '../engine/game-options.js';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { EventEmitter } from '../engine/events.js';
import { SeededRandom } from '../engine/seeded-random.js';
import { THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '../levels/level-thumbnail.js';
import { PLAYERS } from '../levels/versus-arena.js';
import {
  drawKeyHintRows,
  drawMenuTitle,
  drawWithMenuMotion,
  HINT_ROW_HEIGHT,
  KEYCAP_HEIGHT,
  MenuMotion,
  seatHintRows,
  TITLE_HEIGHT,
  wrapMenuIndex,
} from '../ui/menu-kit.js';
import { MenuInput } from '../ui/menu-input.js';
import { MENU_BACKGROUND_COLOR, NO_WATER_LINE_Y } from '../ui/menu-screen.js';
import { TAG_LABEL_BY_PLAYER_ID } from '../ui/player-tags.js';
import { drawText, measureText } from '../ui/text.js';
import { drawCharacterBody, FRAME_SIZE } from '../vfx/character-body.js';
import { EYE_STIFFNESSES, GooglyEye } from '../vfx/googly-eyes.js';
import { ModeSelectScene } from './mode-select-scene.js';
import { PausableMatchScene } from './pausable-match-scene.js';
import { VersusScene } from './versus-scene.js';

const MAX_CARDS_PER_ROW = 4;
// Vertical gaps between the title, the grid, the vote prompts and the key hints, which are centered as one block.
const TITLE_GAP = 10;
const PROMPT_GAP = 8;
const HINT_GAP = 8;
// Room for the two keyboard players' rows of hints.
const HINTS_HEIGHT = HINT_ROW_HEIGHT + KEYCAP_HEIGHT;
const HINTS_WIDTH = 360;
const TILE_GAP_X = 16;
const TILE_GAP_Y = 8;
// The dark border drawn around every thumbnail. The selected tile's border turns into the selection frame.
const TILE_BORDER = 2;
const TILE_BORDER_COLOR = '#3e2731';
const OUTLINE_COLOR = '#3e2731';
const SELECTED_LIFT = 2;
const CAPTION_HEIGHT = 10;
const TEXT_GLYPH_HEIGHT = 5;
const CAPTION_COLOR = '#c0cbdc';
const DIM_COLOR = '#181425';
const DIM_ALPHA = 0.4;
const BADGE_MARGIN = 4;

const RANDOM_LABEL = 'Random';
const RANDOM_MARK_SCALE = 6;
const RANDOM_MARK_TOP_Y = 14;
const RANDOM_MARK_COLOR = '#5a6988';

// Where each voter's prompt sits, as offsets from the screen's center, by how many players vote. One person playing
// against computers votes alone.
const STATUS_OFFSETS_X = { 1: [0], 2: [-148, 148], 3: [-200, 0, 200], 4: [-240, -80, 80, 240] };
const HINT_ROWS = seatHintRows('Vote');
const SELECTED_COLOR = '#feae34';

// How long the picked tile flashes before the match starts, and how fast it flashes.
const REVEAL_TICKS = 60;
const REVEAL_FLASH_TICKS = 6;

const BADGE_EYES = EYE_STIFFNESSES.map((stiffness) => new GooglyEye(stiffness));

export class LevelSelectScene {
  // computerPlayerIds are the seats computer players fill: they play the match but do not vote.
  constructor({
    sceneManager,
    levels,
    characterByPlayerId,
    computerPlayerIds = [],
    sprites = {},
    seed = Date.now(),
    mode = 'knockout',
  }) {
    this.sceneManager = sceneManager;
    this.events = new EventEmitter();
    this.musicTrackName = 'menu';
    this.levels = levels;
    this.characterByPlayerId = characterByPlayerId;
    this.computerPlayerIds = computerPlayerIds;
    this.sprites = sprites;
    this.seed = seed;
    this.mode = mode;
    this.waterLineY = NO_WATER_LINE_Y;
    this.backgroundDrawn = false;
    // Seeded from the real input on the first tick this scene runs, so the jump that picked the mode never counts as
    // a fresh press here.
    this.menuInput = null;
    // A cursor is an index into levels, or levels.length for the Random tile.
    this.cursorByPlayerId = {};
    this.lockedByPlayerId = {};
    // Only the people who joined vote, in seat order.
    this.voters = PLAYERS.filter((spawn) => spawn.id in characterByPlayerId && !computerPlayerIds.includes(spawn.id));
    for (const spawn of this.voters) {
      this.cursorByPlayerId[spawn.id] = levels.length;
      this.lockedByPlayerId[spawn.id] = false;
    }
    this.pickedLevel = null;
    this.revealTicksRemaining = 0;
    this.menuMotion = new MenuMotion();
  }

  update(inputByPlayerId) {
    this.menuMotion.update();
    if (this.pickedLevel) {
      this.revealTicksRemaining--;
      if (this.revealTicksRemaining <= 0) this.startMatch();
      return;
    }

    if (!this.menuInput) {
      this.menuInput = new MenuInput(inputByPlayerId);
      return;
    }

    const pressesByPlayerId = this.menuInput.pressesByPlayerId(inputByPlayerId);
    for (const spawn of this.voters) {
      const presses = pressesByPlayerId[spawn.id];
      if (!presses) continue;
      if (presses.back) {
        if (this.stepBack(spawn.id)) return;
        continue;
      }
      if (this.lockedByPlayerId[spawn.id]) continue;
      const step = (presses.right ? 1 : 0) - (presses.left ? 1 : 0);
      if (step !== 0) {
        this.cursorByPlayerId[spawn.id] = wrapMenuIndex(this.cursorByPlayerId[spawn.id], step, this.levels.length + 1);
        this.events.emit('menu-moved', { playerId: spawn.id });
      }
      if (presses.confirm) {
        this.lockedByPlayerId[spawn.id] = true;
        this.events.emit('menu-selected', { playerId: spawn.id });
      }
    }

    if (Object.values(this.lockedByPlayerId).every((locked) => locked)) {
      this.pickedLevel = this.pickLevel();
      this.revealTicksRemaining = REVEAL_TICKS;
    }
  }

  // Back takes a vote back, and with no vote to take back it returns to the mode screen. True when it left the screen.
  stepBack(playerId) {
    this.events.emit('menu-moved', { playerId });
    if (this.lockedByPlayerId[playerId]) {
      this.lockedByPlayerId[playerId] = false;
      return false;
    }
    this.sceneManager.setScene(
      new ModeSelectScene({
        sceneManager: this.sceneManager,
        levels: this.levels,
        characterByPlayerId: this.characterByPlayerId,
        computerPlayerIds: this.computerPlayerIds,
        sprites: this.sprites,
        seed: this.seed,
      }),
    );
    return true;
  }

  // The level with the most votes wins. A Random vote first turns into a vote for one random level, and a tie
  // between the leaders is broken at random. Every draw comes from the seed, so the same votes always pick the same level.
  pickLevel() {
    const random = new SeededRandom(this.seed);
    const pickIndex = (count) => Math.floor(random.next() * count);
    const votesByLevelIndex = new Array(this.levels.length).fill(0);
    for (const cursor of Object.values(this.cursorByPlayerId)) {
      votesByLevelIndex[cursor < this.levels.length ? cursor : pickIndex(this.levels.length)]++;
    }
    const mostVotes = Math.max(...votesByLevelIndex);
    const leaders = this.levels.filter((level, index) => votesByLevelIndex[index] === mostVotes);
    return leaders[pickIndex(leaders.length)];
  }

  startMatch() {
    this.sceneManager.setScene(
      new PausableMatchScene({
        sceneManager: this.sceneManager,
        matchScene: new VersusScene({
          level: this.pickedLevel,
          seed: this.seed,
          players: PLAYERS.filter(({ id }) => id in this.characterByPlayerId).map(({ id }) => ({
            id,
            character: this.characterByPlayerId[id],
            computer: this.computerPlayerIds.includes(id),
          })),
          sprites: this.sprites,
          levels: this.levels,
          heat: gameOptions.heat,
          mode: this.mode,
        }),
      }),
    );
  }

  render(renderer) {
    if (!this.backgroundDrawn) {
      renderer.updateBackground((context) => drawLevelSelectBackground(context));
      this.backgroundDrawn = true;
    }

    renderer.clearGameLayer();
    renderer.clearUiLayer();
    drawWithMenuMotion(renderer.uiContext, this.menuMotion, () => drawLevelSelectUi(renderer.uiContext, this));
  }
}

function drawLevelSelectBackground(context) {
  context.fillStyle = MENU_BACKGROUND_COLOR;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
}

// The title, cards, prompts and key hints are stacked and centered vertically as one block.
// Cards fill rows evenly, at most MAX_CARDS_PER_ROW to a row, and a last row that is not full sits
// centered. Each tile is the thumbnail's top left corner, inside its border. Each bounds box holds the
// border, the thumbnail, the caption and the lift of a selected tile, so no two may overlap.
export function levelSelectLayout(cardCount) {
  const rows = Math.ceil(cardCount / MAX_CARDS_PER_ROW);
  const columns = Math.ceil(cardCount / rows);
  const tileWidth = THUMBNAIL_WIDTH + TILE_BORDER * 2;
  const tileHeight = THUMBNAIL_HEIGHT + TILE_BORDER * 2 + CAPTION_HEIGHT;
  const gridHeight = rows * tileHeight + (rows - 1) * TILE_GAP_Y;
  const blockHeight =
    TITLE_HEIGHT + TITLE_GAP + SELECTED_LIFT + gridHeight + PROMPT_GAP + TEXT_GLYPH_HEIGHT + HINT_GAP + HINTS_HEIGHT;
  const titleY = Math.floor((SCREEN_HEIGHT - blockHeight) / 2);
  const gridTopY = titleY + TITLE_HEIGHT + TITLE_GAP + SELECTED_LIFT;
  const promptY = gridTopY + gridHeight + PROMPT_GAP;
  const hintY = promptY + TEXT_GLYPH_HEIGHT + HINT_GAP;
  const tiles = [];
  const bounds = [];
  for (let index = 0; index < cardCount; index++) {
    const row = Math.floor(index / columns);
    const cardsInRow = Math.min(columns, cardCount - row * columns);
    const rowWidth = cardsInRow * tileWidth + (cardsInRow - 1) * TILE_GAP_X;
    const boundsX = (SCREEN_WIDTH - rowWidth) / 2 + (index % columns) * (tileWidth + TILE_GAP_X);
    const boundsY = gridTopY + row * (tileHeight + TILE_GAP_Y);
    tiles.push({ x: boundsX + TILE_BORDER, y: boundsY + TILE_BORDER });
    bounds.push({ x: boundsX, y: boundsY - SELECTED_LIFT, width: tileWidth, height: tileHeight + SELECTED_LIFT });
  }
  return { rows, columns, tiles, bounds, titleY, promptY, hintY };
}

function drawFrame(context, x, y, color) {
  context.fillStyle = color;
  const width = THUMBNAIL_WIDTH + TILE_BORDER * 2;
  const height = THUMBNAIL_HEIGHT + TILE_BORDER * 2;
  context.fillRect(x, y, width, TILE_BORDER);
  context.fillRect(x, y + height - TILE_BORDER, width, TILE_BORDER);
  context.fillRect(x, y, TILE_BORDER, height);
  context.fillRect(x + width - TILE_BORDER, y, TILE_BORDER, height);
}

function drawTile(context, x, y, level, { selected, dimmed }) {
  const panelX = x - TILE_BORDER;
  const panelY = y - TILE_BORDER;
  drawFrame(context, panelX, panelY, selected ? SELECTED_COLOR : TILE_BORDER_COLOR);
  if (level) {
    context.imageSmoothingEnabled = false;
    context.drawImage(level.thumbnail, x, y);
  } else {
    drawText(context, '?', x + THUMBNAIL_WIDTH / 2, y + RANDOM_MARK_TOP_Y, {
      scale: RANDOM_MARK_SCALE,
      align: 'center',
      color: RANDOM_MARK_COLOR,
    });
  }
  if (dimmed) {
    context.globalAlpha = DIM_ALPHA;
    context.fillStyle = DIM_COLOR;
    context.fillRect(x, y, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
    context.globalAlpha = 1;
  }
}

// The caption stays put when its tile lifts, so it sits at the tile's resting position.
function drawCaption(context, x, restingY, level, selected) {
  const captionY = restingY + THUMBNAIL_HEIGHT + TILE_BORDER + Math.floor((CAPTION_HEIGHT - TEXT_GLYPH_HEIGHT) / 2);
  const caption = level ? level.name : RANDOM_LABEL;
  drawText(context, caption, x + Math.floor((THUMBNAIL_WIDTH - measureText(caption)) / 2), captionY, {
    scale: 1,
    color: selected ? SELECTED_COLOR : CAPTION_COLOR,
    outlineColor: OUTLINE_COLOR,
  });
}

// The player's character sits in a corner of the tile by seat: top left, top right, bottom left, bottom right,
// so everyone shows on a shared tile.
function drawBadge(context, x, y, seatIndex, character, sprites) {
  const offsetX = BADGE_MARGIN + FRAME_SIZE / 2;
  const isRightColumn = seatIndex % 2 === 1;
  const isBottomRow = seatIndex >= 2;
  drawCharacterBody(context, {
    sprite: sprites[character.spriteName].body,
    eyeFramePositions: character.eyeFramePositions,
    eyes: BADGE_EYES,
    centerX: isRightColumn ? x + THUMBNAIL_WIDTH - offsetX : x + offsetX,
    bottomY: isBottomRow ? y + THUMBNAIL_HEIGHT - BADGE_MARGIN : y + BADGE_MARGIN + FRAME_SIZE,
    width: FRAME_SIZE,
    height: FRAME_SIZE,
  });
}

export function voterPromptCenterX(voterIndex, voterCount) {
  return SCREEN_WIDTH / 2 + STATUS_OFFSETS_X[voterCount][voterIndex];
}

function drawLevelSelectUi(context, scene) {
  const cardCount = scene.levels.length + 1;
  const { tiles, titleY, promptY, hintY } = levelSelectLayout(cardCount);
  drawMenuTitle(context, 'Level Select', titleY);
  const pickedIndex = scene.levels.indexOf(scene.pickedLevel);
  const flashOn = Math.floor(scene.revealTicksRemaining / REVEAL_FLASH_TICKS) % 2 === 0;
  for (let tileIndex = 0; tileIndex < cardCount; tileIndex++) {
    const playersHere = scene.voters.filter((spawn) => scene.cursorByPlayerId[spawn.id] === tileIndex);
    const isSelected = scene.pickedLevel ? tileIndex === pickedIndex : playersHere.length > 0;
    const isLit = scene.pickedLevel ? isSelected && flashOn : isSelected;
    const restingY = tiles[tileIndex].y;
    const x = tiles[tileIndex].x;
    const y = restingY - (isLit ? SELECTED_LIFT : 0);
    drawTile(context, x, y, scene.levels[tileIndex], { selected: isLit, dimmed: !isSelected });
    drawCaption(context, x, restingY, scene.levels[tileIndex], isSelected);
    for (const spawn of playersHere) {
      drawBadge(context, x, y, PLAYERS.indexOf(spawn), scene.characterByPlayerId[spawn.id], scene.sprites);
    }
  }

  if (scene.pickedLevel) return;
  scene.voters.forEach((spawn, voterIndex) => {
    const centerX = voterPromptCenterX(voterIndex, scene.voters.length);
    const locked = scene.lockedByPlayerId[spawn.id];
    const prompt = `${TAG_LABEL_BY_PLAYER_ID[spawn.id]} ${locked ? 'Locked in!' : 'Press jump to vote'}`;
    drawText(context, prompt, centerX - Math.floor(measureText(prompt) / 2), promptY, {
      scale: 1,
      outlineColor: OUTLINE_COLOR,
      color: scene.characterByPlayerId[spawn.id].tagColor,
    });
  });
  drawKeyHintRows(context, HINT_ROWS, { topY: hintY, width: HINTS_WIDTH });
}
