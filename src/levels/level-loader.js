import { LEVEL_COLUMNS, LEVEL_ROWS, TILE_SIZE } from '../engine/config.js';

const EMPTY_TILE = '.';

// Turns a level file into what a scene plays: one platform rectangle per horizontal run of tiles in a row,
// plus every tile to draw. Every character in the legend is solid.
export function buildLevel(levelData, tileSprites = {}) {
  const { name, grid, legend, spawns, waterLineY, mood } = levelData;
  if (grid.length !== LEVEL_ROWS) throw new Error(`Level ${name} has ${grid.length} rows, expected ${LEVEL_ROWS}`);
  const tiles = [];
  const platforms = [];
  grid.forEach((row, rowIndex) => {
    if (row.length !== LEVEL_COLUMNS) {
      throw new Error(`Level ${name} row ${rowIndex} is ${row.length} wide, expected ${LEVEL_COLUMNS}`);
    }
    let runStartColumn = null;
    for (let column = 0; column <= LEVEL_COLUMNS; column++) {
      const character = row[column] ?? EMPTY_TILE;
      const solid = character !== EMPTY_TILE;
      if (solid) {
        if (!(character in legend))
          throw new Error(`Level ${name} uses "${character}" at ${column},${rowIndex}, not in its legend`);
        tiles.push({ x: column * TILE_SIZE, y: rowIndex * TILE_SIZE, name: legend[character] });
        runStartColumn ??= column;
      } else if (runStartColumn !== null) {
        platforms.push({
          x: runStartColumn * TILE_SIZE,
          y: rowIndex * TILE_SIZE,
          width: (column - runStartColumn) * TILE_SIZE,
          height: TILE_SIZE,
        });
        runStartColumn = null;
      }
    }
  });
  return { name, tiles, platforms, spawns, waterLineY, mood, tileSprites };
}

export async function loadLevel(path, tileSprites) {
  const levelData = await fetch(path).then((response) => response.json());
  return buildLevel(levelData, tileSprites);
}
