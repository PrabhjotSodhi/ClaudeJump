import { loadSpriteFile } from '../engine/sprites.js';
import { LEVEL_COLUMNS, LEVEL_ROWS, TILE_SIZE } from '../engine/config.js';

const EMPTY_TILE = '.';
const SMALL_BLOCK = 's';
const BIG_BLOCK = 'B';
const GIRDER = '=';
const CHAIN_LINK_HEIGHT = 8;
const CHAIN_OFFSET_X = 6;

function blockName(size, column, rowIndex) {
  return `block-${size}-${(rowIndex * 7 + column * 3) % 2}`;
}

function girderTiles(startColumn, endColumn, rowIndex) {
  const y = rowIndex * TILE_SIZE;
  const tiles = [];
  for (let column = startColumn; column < endColumn; column++) {
    const name = column === startColumn ? 'girder-left' : column === endColumn - 1 ? 'girder-right' : 'girder-middle';
    tiles.push({ x: column * TILE_SIZE, y, name });
  }
  for (const column of [startColumn, endColumn - 1]) {
    for (let linkY = y - CHAIN_LINK_HEIGHT; linkY > -CHAIN_LINK_HEIGHT; linkY -= CHAIN_LINK_HEIGHT) {
      tiles.push({ x: column * TILE_SIZE + CHAIN_OFFSET_X, y: linkY, name: 'chain' });
    }
  }
  return tiles;
}

export function stoneColorOverrides({ light, mid, dark }) {
  return { l: light, m: mid, d: dark };
}

function rowRun(startColumn, endColumn, rowIndex) {
  return {
    x: startColumn * TILE_SIZE,
    y: rowIndex * TILE_SIZE,
    width: (endColumn - startColumn) * TILE_SIZE,
    height: TILE_SIZE,
  };
}

// Turns a level file into what a scene plays: one platform rectangle per horizontal run of tiles in a row,
// plus every tile to draw. Every character except '.' is solid.
// 's' is a small block, a 2x2 square of 'B' is one big block and a run of '=' is a girder hung on chains.
// openTops are the runs of tiles with no tile anywhere above them, so a crate dropped from above lands exactly there.
export function buildLevel(levelData, tileSprites = {}) {
  const { name, stone, grid, spawns, bouncePads = [], waterLineY, suddenDeathLineY, mood } = levelData;
  if (grid.length !== LEVEL_ROWS) throw new Error(`Level ${name} has ${grid.length} rows, expected ${LEVEL_ROWS}`);
  const tiles = [];
  const platforms = [];
  const openTops = [];
  const coveredColumns = new Set();
  const claimedBigBlockCells = new Set();
  grid.forEach((row, rowIndex) => {
    if (row.length !== LEVEL_COLUMNS) {
      throw new Error(`Level ${name} row ${rowIndex} is ${row.length} wide, expected ${LEVEL_COLUMNS}`);
    }
    for (const { 0: run, index } of row.matchAll(/=+/g))
      tiles.push(...girderTiles(index, index + run.length, rowIndex));
    let runStartColumn = null;
    let openRunStartColumn = null;
    for (let column = 0; column <= LEVEL_COLUMNS; column++) {
      const character = row[column] ?? EMPTY_TILE;
      const solid = character !== EMPTY_TILE;
      if (solid) {
        if (character === SMALL_BLOCK) {
          tiles.push({ x: column * TILE_SIZE, y: rowIndex * TILE_SIZE, name: blockName('small', column, rowIndex) });
        } else if (character === BIG_BLOCK && !claimedBigBlockCells.has(`${column},${rowIndex}`)) {
          const cells = [
            [column, rowIndex],
            [column + 1, rowIndex],
            [column, rowIndex + 1],
            [column + 1, rowIndex + 1],
          ];
          const unclaimedBigBlockCells = cells.every(
            ([cellColumn, cellRow]) =>
              grid[cellRow]?.[cellColumn] === BIG_BLOCK && !claimedBigBlockCells.has(`${cellColumn},${cellRow}`),
          );
          if (!unclaimedBigBlockCells) throw new Error(`Level ${name} has a broken big block at ${column},${rowIndex}`);
          for (const [cellColumn, cellRow] of cells) claimedBigBlockCells.add(`${cellColumn},${cellRow}`);
          tiles.push({ x: column * TILE_SIZE, y: rowIndex * TILE_SIZE, name: blockName('big', column, rowIndex) });
        } else if (character !== BIG_BLOCK && character !== GIRDER) {
          throw new Error(`Level ${name} uses "${character}" at ${column},${rowIndex}, which is not a block or girder`);
        }
        runStartColumn ??= column;
      } else if (runStartColumn !== null) {
        platforms.push(rowRun(runStartColumn, column, rowIndex));
        runStartColumn = null;
      }
      if (solid && !coveredColumns.has(column)) {
        openRunStartColumn ??= column;
      } else if (openRunStartColumn !== null) {
        openTops.push(rowRun(openRunStartColumn, column, rowIndex));
        openRunStartColumn = null;
      }
    }
    for (let column = 0; column < LEVEL_COLUMNS; column++) {
      if (row[column] !== EMPTY_TILE) coveredColumns.add(column);
    }
  });
  return {
    name,
    stone,
    tiles,
    platforms,
    openTops,
    spawns,
    bouncePads,
    waterLineY,
    suddenDeathLineY,
    mood,
    tileSprites,
  };
}

export async function loadLevel(path) {
  const levelData = await fetch(path).then((response) => response.json());
  const blockSprites = await loadSpriteFile(
    'data/sprites/blocks.json',
    levelData.stone && stoneColorOverrides(levelData.stone),
  );
  return buildLevel(levelData, blockSprites);
}
