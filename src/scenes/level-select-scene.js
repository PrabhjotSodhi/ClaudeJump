import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { SeededRandom } from '../engine/seeded-random.js';
import { THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '../levels/level-thumbnail.js';
import { PLAYERS } from '../levels/versus-arena.js';
import {
  drawKeyHints,
  drawMenuTitle,
  KEYCAP_HEIGHT,
  rowIndexAt,
  TITLE_HEIGHT,
  tapPoint,
  wrapMenuIndex,
} from '../ui/menu-kit.js';
import { MENU_BACKGROUND_COLOR, NO_WATER_LINE_Y } from '../ui/menu-screen.js';
import { drawPanel } from '../ui/panel.js';
import { drawText, measureText } from '../ui/text.js';
import { drawCharacterBody, FRAME_SIZE } from '../vfx/character-body.js';
import { EYE_STIFFNESSES, GooglyEye } from '../vfx/googly-eyes.js';
import { PausableMatchScene } from './pausable-match-scene.js';
import { VersusScene } from './versus-scene.js';

const MAX_CARDS_PER_ROW = 4;
// Vertical gaps between the title, the grid, the vote prompts and the key hints, which are centered as one block.
const TITLE_GAP = 16;
const PROMPT_GAP = 12;
const HINT_GAP = 8;
const TILE_GAP_X = 16;
const TILE_GAP_Y = 8;
// The panel border drawn around every thumbnail. The selected tile's border turns into the selection frame.
const TILE_BORDER = 2;
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

const STATUS_OFFSET_X = 148;
const HINTS = [
  { keys: ['A', 'D', 'S', 'Left', 'Right', 'Down'], label: 'Move' },
  { keys: ['W', 'Up'], label: 'Vote' },
];
const SELECTED_COLOR = '#feae34';

// How long the picked tile flashes before the match starts, and how fast it flashes.
const REVEAL_TICKS = 60;
const REVEAL_FLASH_TICKS = 6;

const BADGE_EYES = EYE_STIFFNESSES.map((stiffness) => new GooglyEye(stiffness));

export class LevelSelectScene {
  constructor({ sceneManager, levels, characterByPlayerId, sprites = {}, seed = Date.now() }) {
    this.sceneManager = sceneManager;
    this.levels = levels;
    this.characterByPlayerId = characterByPlayerId;
    this.sprites = sprites;
    this.seed = seed;
    this.waterLineY = NO_WATER_LINE_Y;
    this.backgroundDrawn = false;
    // Captured from the real input on the first tick this scene runs, so the jump that locked in a
    // character on player select never counts as a fresh press here.
    this.previousInput = null;
    // A cursor is an index into levels, or levels.length for the Random tile.
    this.cursorByPlayerId = {};
    this.lockedByPlayerId = {};
    for (const spawn of PLAYERS) {
      this.cursorByPlayerId[spawn.id] = levels.length;
      this.lockedByPlayerId[spawn.id] = false;
    }
    this.pickedLevel = null;
    this.revealTicksRemaining = 0;
  }

  update(inputByPlayerId) {
    if (this.pickedLevel) {
      this.revealTicksRemaining--;
      if (this.revealTicksRemaining <= 0) this.startMatch();
      return;
    }

    if (!this.previousInput) {
      this.previousInput = {};
      for (const spawn of PLAYERS) this.previousInput[spawn.id] = { ...inputByPlayerId[spawn.id] };
      return;
    }

    for (const spawn of PLAYERS) {
      const input = inputByPlayerId[spawn.id] ?? {};
      const previous = this.previousInput[spawn.id];
      if (!this.lockedByPlayerId[spawn.id]) {
        if (input.left && !previous.left) this.moveAlongRow(spawn.id, -1);
        if (input.right && !previous.right) this.moveAlongRow(spawn.id, 1);
        if (input.down && !previous.down) this.moveDown(spawn.id);
        if (input.jump && !previous.jump) this.lockedByPlayerId[spawn.id] = true;
      }
      this.previousInput[spawn.id] = { ...input };
    }

    this.selectTappedTile(inputByPlayerId);

    if (Object.values(this.lockedByPlayerId).every((locked) => locked)) {
      this.pickedLevel = this.pickLevel();
      this.revealTicksRemaining = REVEAL_TICKS;
    }
  }

  // Touch drives the first player. A tap moves their cursor to the tile, and a tap on the tile they are on votes.
  selectTappedTile(inputByPlayerId) {
    const playerId = PLAYERS[0].id;
    const tappedIndex = rowIndexAt(levelSelectLayout(this.levels.length + 1).bounds, tapPoint(inputByPlayerId));
    if (tappedIndex < 0 || this.lockedByPlayerId[playerId]) return;
    if (this.cursorByPlayerId[playerId] === tappedIndex) this.lockedByPlayerId[playerId] = true;
    else this.cursorByPlayerId[playerId] = tappedIndex;
  }

  // Left and right wrap inside the cursor's row, which may be a shorter last row.
  moveAlongRow(playerId, direction) {
    const cardCount = this.levels.length + 1;
    const { columns } = levelSelectLayout(cardCount);
    const cursor = this.cursorByPlayerId[playerId];
    const rowStart = cursor - (cursor % columns);
    const rowLength = Math.min(columns, cardCount - rowStart);
    this.cursorByPlayerId[playerId] = rowStart + wrapMenuIndex(cursor - rowStart, direction, rowLength);
  }

  // Down keeps the column and wraps from the last row to the first. A column missing from the last row skips it.
  moveDown(playerId) {
    const cardCount = this.levels.length + 1;
    const { columns } = levelSelectLayout(cardCount);
    const cursor = this.cursorByPlayerId[playerId];
    const below = cursor + columns;
    this.cursorByPlayerId[playerId] = below < cardCount ? below : cursor % columns;
  }

  // Every vote for a level is one ticket for it, and a Random vote is one ticket for every level.
  pickLevel() {
    const tickets = [];
    for (const vote of Object.values(this.cursorByPlayerId)) {
      if (vote < this.levels.length) tickets.push(this.levels[vote]);
      else tickets.push(...this.levels);
    }
    return tickets[Math.floor(new SeededRandom(this.seed).next() * tickets.length)];
  }

  startMatch() {
    this.sceneManager.setScene(
      new PausableMatchScene({
        sceneManager: this.sceneManager,
        matchScene: new VersusScene({
          level: this.pickedLevel,
          seed: this.seed,
          characterByPlayerId: this.characterByPlayerId,
          sprites: this.sprites,
          levels: this.levels,
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
    drawLevelSelectUi(renderer.uiContext, this);
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
    TITLE_HEIGHT + TITLE_GAP + SELECTED_LIFT + gridHeight + PROMPT_GAP + TEXT_GLYPH_HEIGHT + HINT_GAP + KEYCAP_HEIGHT;
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

function drawFrame(context, x, y) {
  context.fillStyle = SELECTED_COLOR;
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
  drawPanel(context, panelX, panelY, THUMBNAIL_WIDTH + TILE_BORDER * 2, THUMBNAIL_HEIGHT + TILE_BORDER * 2);
  if (selected) drawFrame(context, panelX, panelY);
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
    outlineColor: null,
  });
}

// The player's character sits in the tile's top corner on their side, so both players show on a shared tile.
function drawBadge(context, x, y, playerIndex, character, sprites) {
  const offsetX = BADGE_MARGIN + FRAME_SIZE / 2;
  drawCharacterBody(context, {
    sprite: sprites[character.spriteName].body,
    eyeFramePositions: character.eyeFramePositions,
    eyes: BADGE_EYES,
    centerX: playerIndex === 0 ? x + offsetX : x + THUMBNAIL_WIDTH - offsetX,
    bottomY: y + BADGE_MARGIN + FRAME_SIZE,
    width: FRAME_SIZE,
    height: FRAME_SIZE,
  });
}

function drawLevelSelectUi(context, scene) {
  const cardCount = scene.levels.length + 1;
  const { tiles, titleY, promptY, hintY } = levelSelectLayout(cardCount);
  drawMenuTitle(context, 'Level Select', titleY);
  const pickedIndex = scene.levels.indexOf(scene.pickedLevel);
  const flashOn = Math.floor(scene.revealTicksRemaining / REVEAL_FLASH_TICKS) % 2 === 0;
  for (let tileIndex = 0; tileIndex < cardCount; tileIndex++) {
    const playersHere = PLAYERS.filter((spawn) => scene.cursorByPlayerId[spawn.id] === tileIndex);
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
  PLAYERS.forEach((spawn, playerIndex) => {
    const centerX = SCREEN_WIDTH / 2 + (playerIndex === 0 ? -STATUS_OFFSET_X : STATUS_OFFSET_X);
    const locked = scene.lockedByPlayerId[spawn.id];
    const prompt = locked ? 'Locked in!' : 'Press jump to vote';
    drawText(context, prompt, centerX - Math.floor(measureText(prompt) / 2), promptY, {
      scale: 1,
      outlineColor: null,
      color: scene.characterByPlayerId[spawn.id].tagColor,
    });
  });
  drawKeyHints(context, HINTS, hintY);
}
