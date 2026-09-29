import { LEVEL_COLUMNS, LEVEL_ROWS, TILE_SIZE } from '../engine/config.js';

const EMPTY_TILE = '.';

function rowRun(startColumn, endColumn, rowIndex) {
  return {
    x: startColumn * TILE_SIZE,
    y: rowIndex * TILE_SIZE,
    width: (endColumn - startColumn) * TILE_SIZE,
    height: TILE_SIZE,
  };
}

// Turns a level file into what a scene plays: one platform rectangle per horizontal run of tiles in a row,
// plus every tile to draw. Every character in the legend is solid.
// openTops are the runs of tiles with no tile anywhere above them, so a crate dropped from above lands exactly there.
export function buildLevel(levelData, tileSprites = {}) {
  const { name, background, grid, legend, spawns, bouncePads = [], waterLineY, suddenDeathLineY, mood } = levelData;
  if (grid.length !== LEVEL_ROWS) throw new Error(`Level ${name} has ${grid.length} rows, expected ${LEVEL_ROWS}`);
  const tiles = [];
  const platforms = [];
  const openTops = [];
  const coveredColumns = new Set();
  grid.forEach((row, rowIndex) => {
    if (row.length !== LEVEL_COLUMNS) {
      throw new Error(`Level ${name} row ${rowIndex} is ${row.length} wide, expected ${LEVEL_COLUMNS}`);
    }
    let runStartColumn = null;
    let openRunStartColumn = null;
    for (let column = 0; column <= LEVEL_COLUMNS; column++) {
      const character = row[column] ?? EMPTY_TILE;
      const solid = character !== EMPTY_TILE;
      if (solid) {
        if (!(character in legend))
          throw new Error(`Level ${name} uses "${character}" at ${column},${rowIndex}, not in its legend`);
        tiles.push({ x: column * TILE_SIZE, y: rowIndex * TILE_SIZE, name: legend[character] });
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
    background,
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

export async function loadLevel(path, tileSprites) {
  const levelData = await fetch(path).then((response) => response.json());
  return buildLevel(levelData, tileSprites);
}
