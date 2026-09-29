import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { SeededRandom } from '../engine/seeded-random.js';
import { THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '../levels/level-thumbnail.js';
import { PLAYERS } from '../levels/versus-arena.js';
import { MENU_BACKGROUND_COLOR, NO_WATER_LINE_Y } from '../ui/menu-screen.js';
import { drawPanel } from '../ui/panel.js';
import { drawText } from '../ui/text.js';
import { drawCharacterBody, FRAME_SIZE } from '../vfx/character-body.js';
import { EYE_STIFFNESSES, GooglyEye } from '../vfx/googly-eyes.js';
import { PausableMatchScene } from './pausable-match-scene.js';
import { VersusScene } from './versus-scene.js';

const TITLE_Y = 60;
const TITLE_SCALE = 6;

const GRID_COLUMNS = 3;
const GRID_TOP_Y = 114;
const TILE_GAP_X = 24;
const TILE_GAP_Y = 18;
const GRID_LEFT_X = (SCREEN_WIDTH - GRID_COLUMNS * THUMBNAIL_WIDTH - (GRID_COLUMNS - 1) * TILE_GAP_X) / 2;
// The panel border drawn around every thumbnail, and the cursor ring drawn around that.
const TILE_BORDER = 2;
const CURSOR_GAP = 1;
const CURSOR_THICKNESS = 2;
const CAPTION_BOTTOM_MARGIN = 14;
const CAPTION_COLOR = '#ffffff';
const BADGE_MARGIN = 4;

const RANDOM_LABEL = 'Random';
const RANDOM_MARK_SCALE = 8;
const RANDOM_MARK_TOP_Y = 16;
const RANDOM_MARK_COLOR = '#5a6988';

const STATUS_Y = 330;
const STATUS_OFFSET_X = 148;
const PICKED_COLOR = '#feae34';

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
        if (input.left && !previous.left) this.moveCursor(spawn.id, -1);
        if (input.right && !previous.right) this.moveCursor(spawn.id, 1);
        if (input.jump && !previous.jump) this.lockedByPlayerId[spawn.id] = true;
      }
      this.previousInput[spawn.id] = { ...input };
    }

    if (Object.values(this.lockedByPlayerId).every((locked) => locked)) {
      this.pickedLevel = this.pickLevel();
      this.revealTicksRemaining = REVEAL_TICKS;
    }
  }

  moveCursor(playerId, direction) {
    const tileCount = this.levels.length + 1;
    this.cursorByPlayerId[playerId] = (this.cursorByPlayerId[playerId] + direction + tileCount) % tileCount;
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

// Top left corner of the thumbnail inside a tile's border. A last row that is not full sits centered.
function tilePosition(tileIndex, tileCount) {
  const column = tileIndex % GRID_COLUMNS;
  const row = Math.floor(tileIndex / GRID_COLUMNS);
  const tilesInRow = Math.min(GRID_COLUMNS, tileCount - row * GRID_COLUMNS);
  const rowIndent = ((GRID_COLUMNS - tilesInRow) * (THUMBNAIL_WIDTH + TILE_GAP_X)) / 2;
  return {
    x: GRID_LEFT_X + rowIndent + column * (THUMBNAIL_WIDTH + TILE_GAP_X),
    y: GRID_TOP_Y + row * (THUMBNAIL_HEIGHT + TILE_GAP_Y),
  };
}

function drawTile(context, x, y, level, captionColor) {
  drawPanel(
    context,
    x - TILE_BORDER,
    y - TILE_BORDER,
    THUMBNAIL_WIDTH + TILE_BORDER * 2,
    THUMBNAIL_HEIGHT + TILE_BORDER * 2,
  );
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
  const caption = level ? level.name : RANDOM_LABEL;
  drawText(context, caption, x + THUMBNAIL_WIDTH / 2, y + THUMBNAIL_HEIGHT - CAPTION_BOTTOM_MARGIN, {
    align: 'center',
    color: captionColor,
  });
}

// A ring around the tile's border. Given two colors, the left half takes the first and the right half the second.
function drawRing(context, x, y, colors) {
  const inset = TILE_BORDER + CURSOR_GAP + CURSOR_THICKNESS;
  const ringX = x - inset;
  const ringY = y - inset;
  const ringWidth = THUMBNAIL_WIDTH + inset * 2;
  const ringHeight = THUMBNAIL_HEIGHT + inset * 2;
  colors.forEach((color, index) => {
    const halfWidth = ringWidth / colors.length;
    context.save();
    context.beginPath();
    context.rect(ringX + index * halfWidth, ringY, halfWidth, ringHeight);
    context.clip();
    context.fillStyle = color;
    context.fillRect(ringX, ringY, ringWidth, CURSOR_THICKNESS);
    context.fillRect(ringX, ringY + ringHeight - CURSOR_THICKNESS, ringWidth, CURSOR_THICKNESS);
    context.fillRect(ringX, ringY, CURSOR_THICKNESS, ringHeight);
    context.fillRect(ringX + ringWidth - CURSOR_THICKNESS, ringY, CURSOR_THICKNESS, ringHeight);
    context.restore();
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
  drawText(context, 'Level Select', SCREEN_WIDTH / 2, TITLE_Y, { scale: TITLE_SCALE, align: 'center' });

  const pickedIndex = scene.levels.indexOf(scene.pickedLevel);
  for (let tileIndex = 0; tileIndex <= scene.levels.length; tileIndex++) {
    const { x, y } = tilePosition(tileIndex, scene.levels.length + 1);
    drawTile(context, x, y, scene.levels[tileIndex], tileIndex === pickedIndex ? PICKED_COLOR : CAPTION_COLOR);

    const playersHere = PLAYERS.filter((spawn) => scene.cursorByPlayerId[spawn.id] === tileIndex);
    if (scene.pickedLevel) {
      const flashOn = Math.floor(scene.revealTicksRemaining / REVEAL_FLASH_TICKS) % 2 === 0;
      if (tileIndex === pickedIndex && flashOn) drawRing(context, x, y, [PICKED_COLOR]);
    } else if (playersHere.length > 0) {
      drawRing(
        context,
        x,
        y,
        playersHere.map((spawn) => scene.characterByPlayerId[spawn.id].tagColor),
      );
    }
    for (const spawn of playersHere) {
      drawBadge(context, x, y, PLAYERS.indexOf(spawn), scene.characterByPlayerId[spawn.id], scene.sprites);
    }
  }

  if (scene.pickedLevel) {
    drawText(context, scene.pickedLevel.name, SCREEN_WIDTH / 2, STATUS_Y, { align: 'center', color: PICKED_COLOR });
    return;
  }
  PLAYERS.forEach((spawn, playerIndex) => {
    const centerX = SCREEN_WIDTH / 2 + (playerIndex === 0 ? -STATUS_OFFSET_X : STATUS_OFFSET_X);
    const locked = scene.lockedByPlayerId[spawn.id];
    drawText(context, locked ? 'Locked in!' : 'Press jump to vote', centerX, STATUS_Y, {
      align: 'center',
      color: scene.characterByPlayerId[spawn.id].tagColor,
    });
  });
}
