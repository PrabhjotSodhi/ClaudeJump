import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { LEVEL_COLUMNS, SCREEN_WIDTH, TILE_SIZE } from '../src/engine/config.js';
import { drawArenaMotion } from '../src/levels/arena-backgrounds.js';
import { arenaLevels } from './fixtures/arena-levels.mjs';

const NEW_ARENAS = ['lighthouse'];
function recordingContext() {
  const fills = [];
  return {
    fills,
    fillStyle: null,
    fillRect(x, y, width, height) {
      fills.push([this.fillStyle, x, y, width, height]);
    },
  };
}

// A full jump rises about 90 pixels and a double jump more, so every step up here stays well inside one jump.
const MAX_RISE = 5 * TILE_SIZE;
const MAX_GAP = 4 * TILE_SIZE;
// A player is 28 pixels tall, so a surface needs two empty cells above it to stand on.
const HEADROOM_CELLS = 2;

// Runs of solid cells a player can stand on: nothing solid in the two cells above.
function standableSurfaces(level) {
  const surfaces = [];
  level.solidCells.forEach((row, rowIndex) => {
    let startColumn = null;
    for (let column = 0; column <= LEVEL_COLUMNS; column++) {
      const clear = [...Array(HEADROOM_CELLS).keys()].every(
        (offset) => !level.solidCells[rowIndex - 1 - offset]?.[column],
      );
      const standable = row[column] && clear && rowIndex > 0;
      if (standable) startColumn ??= column;
      else if (startColumn !== null) {
        surfaces.push({ left: startColumn * TILE_SIZE, right: column * TILE_SIZE, y: rowIndex * TILE_SIZE });
        startColumn = null;
      }
    }
  });
  return surfaces.filter((surface) => surface.y < level.waterLineY);
}

// The screen wraps, so the gap between two surfaces may run across the edge.
function horizontalGap(first, second) {
  return Math.min(
    ...[-SCREEN_WIDTH, 0, SCREEN_WIDTH].map((shift) =>
      Math.max(0, second.left + shift - first.right, first.left - second.right - shift),
    ),
  );
}

function canReach(from, to) {
  return to.y >= from.y - MAX_RISE && horizontalGap(from, to) <= MAX_GAP;
}

for (const name of NEW_ARENAS) {
  const level = arenaLevels[name];

  test(`every surface on ${name} can be reached from every spawn`, () => {
    const surfaces = standableSurfaces(level);
    for (const spawn of level.spawns) {
      const start = surfaces.find(
        (surface) => surface.y === spawn.y && surface.left <= spawn.x && spawn.x <= surface.right,
      );
      assert.ok(start, `${spawn.id} starts on a surface`);
      const reached = new Set([start]);
      const queue = [start];
      while (queue.length > 0) {
        const from = queue.shift();
        for (const to of surfaces) {
          if (reached.has(to) || !canReach(from, to)) continue;
          reached.add(to);
          queue.push(to);
        }
      }
      const missed = surfaces.filter((surface) => !reached.has(surface));
      assert.deepEqual(missed, [], `${spawn.id} reaches every surface`);
    }
  });

  test(`${name} has no hazards and its background moves from the tick alone, in palette colors`, async () => {
    assert.deepEqual(level.hazards, []);
    const palette = JSON.parse(await readFile(new URL('../data/palette.json', import.meta.url), 'utf8'));
    const paletteColors = new Set(Object.values(palette.ramps).flat());
    const frames = [0, 30, 60, 90].map((tick) => {
      const first = recordingContext();
      const second = recordingContext();
      drawArenaMotion(first, level.background, tick);
      drawArenaMotion(second, level.background, tick);
      assert.deepEqual(first.fills, second.fills);
      for (const [color] of first.fills) assert.ok(paletteColors.has(color), `${name} moves in ${color}`);
      return JSON.stringify(first.fills);
    });
    assert.ok(new Set(frames).size > 1, 'the picture changes over time');
  });
}
