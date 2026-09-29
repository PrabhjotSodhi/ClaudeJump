import { loadSpriteFile } from '../engine/sprites.js';
import { LEVEL_COLUMNS, LEVEL_ROWS, TILE_SIZE } from '../engine/config.js';

const EMPTY_TILE = '.';
const SMALL_BLOCK = 's';
const BIG_BLOCK = 'B';
const GIRDER = '=';
const CHAIN_LINK_HEIGHT = 8;
const CHAIN_OFFSET_X = 6;

export function blockName(size, column, rowIndex) {
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

// Turns a grid of solid cells (solidCells[row][column]) into what players collide with: one platform rectangle
// per horizontal run of solid cells in a row, and the openTops, the runs of solid cells with no solid cell anywhere
// above them, so a crate dropped from above lands exactly there.
export function solidRuns(solidCells) {
  const platforms = [];
  const openTops = [];
  const coveredColumns = new Set();
  solidCells.forEach((row, rowIndex) => {
    let runStartColumn = null;
    let openRunStartColumn = null;
    for (let column = 0; column <= LEVEL_COLUMNS; column++) {
      const solid = row[column] ?? false;
      if (solid) {
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
      if (row[column]) coveredColumns.add(column);
    }
  });
  return { platforms, openTops };
}

// Turns a level file into what a scene plays: the platforms and openTops of its solid cells, plus every tile to draw.
// Every character except '.' is solid.
// 's' is a small block, a 2x2 square of 'B' is one big block and a run of '=' is a girder hung on chains.
// blocks lists the breakable ones (girders are not) with the tile that draws each.
export function buildLevel(levelData, tileSprites = {}) {
  const { name, background, stone, grid, spawns, bouncePads = [], waterLineY, suddenDeathLineY } = levelData;
  if (grid.length !== LEVEL_ROWS) throw new Error(`Level ${name} has ${grid.length} rows, expected ${LEVEL_ROWS}`);
  const tiles = [];
  const blocks = [];
  const claimedBigBlockCells = new Set();
  grid.forEach((row, rowIndex) => {
    if (row.length !== LEVEL_COLUMNS) {
      throw new Error(`Level ${name} row ${rowIndex} is ${row.length} wide, expected ${LEVEL_COLUMNS}`);
    }
    for (const { 0: run, index } of row.matchAll(/=+/g))
      tiles.push(...girderTiles(index, index + run.length, rowIndex));
    for (let column = 0; column < LEVEL_COLUMNS; column++) {
      const character = row[column];
      if (character === EMPTY_TILE) continue;

      const x = column * TILE_SIZE;
      const y = rowIndex * TILE_SIZE;
      if (character === SMALL_BLOCK) {
        const tile = { x, y, name: blockName('small', column, rowIndex) };
        tiles.push(tile);
        blocks.push({ x, y, size: TILE_SIZE, tile });
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
        const tile = { x, y, name: blockName('big', column, rowIndex) };
        tiles.push(tile);
        blocks.push({ x, y, size: 2 * TILE_SIZE, tile });
      } else if (character !== BIG_BLOCK && character !== GIRDER) {
        throw new Error(`Level ${name} uses "${character}" at ${column},${rowIndex}, which is not a block or girder`);
      }
    }
  });
  const solidCells = grid.map((row) => [...row].map((character) => character !== EMPTY_TILE));
  const { platforms, openTops } = solidRuns(solidCells);
  return {
    name,
    background,
    stone,
    tiles,
    blocks,
    solidCells,
    platforms,
    openTops,
    spawns,
    bouncePads,
    waterLineY,
    suddenDeathLineY,
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
