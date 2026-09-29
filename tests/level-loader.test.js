import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LEVEL_COLUMNS, LEVEL_ROWS } from '../src/engine/config.js';
import { buildLevel } from '../src/levels/level-loader.js';
import { harborLevel } from './fixtures/harbor-level.mjs';

function levelWithTiles(tilesByRow) {
  const grid = Array.from({ length: LEVEL_ROWS }, (_, row) => (tilesByRow[row] ?? '').padEnd(LEVEL_COLUMNS, '.'));
  return { name: 'Test', grid, legend: { T: 'top', C: 'top-crack' }, spawns: [], waterLineY: 300, mood: {} };
}

test('a horizontal run of solid tiles becomes one platform', () => {
  const level = buildLevel(levelWithTiles({ 5: '...TCT..' }));

  assert.deepEqual(level.platforms, [{ x: 48, y: 80, width: 48, height: 16 }]);
});

test('a gap splits a row into two platforms, and each row gets its own', () => {
  const level = buildLevel(levelWithTiles({ 2: 'TT..T', 3: 'TT' }));

  assert.deepEqual(level.platforms, [
    { x: 0, y: 32, width: 32, height: 16 },
    { x: 64, y: 32, width: 16, height: 16 },
    { x: 0, y: 48, width: 32, height: 16 },
  ]);
});

test('a run that reaches the right edge still becomes a platform', () => {
  const level = buildLevel(levelWithTiles({ 0: 'T'.padStart(LEVEL_COLUMNS, '.') }));

  assert.deepEqual(level.platforms, [{ x: 624, y: 0, width: 16, height: 16 }]);
});

test('every solid tile is drawn with the sprite its legend names', () => {
  const level = buildLevel(levelWithTiles({ 1: 'TC' }));

  assert.deepEqual(level.tiles, [
    { x: 0, y: 16, name: 'top' },
    { x: 16, y: 16, name: 'top-crack' },
  ]);
});

test('a level with a character missing from its legend is rejected', () => {
  assert.throws(() => buildLevel(levelWithTiles({ 0: 'X' })), /not in its legend/);
});

test('a grid of the wrong size is rejected', () => {
  const data = levelWithTiles({});
  data.grid[0] = '.';
  assert.throws(() => buildLevel(data), /wide/);
  assert.throws(() => buildLevel({ ...levelWithTiles({}), grid: [] }), /rows/);
});

test('harbor has the three platforms the arena always had', () => {
  const sorted = [...harborLevel.platforms].sort((first, second) => first.x - second.x);

  assert.deepEqual(sorted, [
    { x: 80, y: 224, width: 144, height: 16 },
    { x: 256, y: 144, width: 128, height: 16 },
    { x: 416, y: 224, width: 144, height: 16 },
  ]);
});

test('harbor loads its spawns, sea line and mood', () => {
  assert.equal(harborLevel.name, 'Harbor');
  assert.equal(harborLevel.waterLineY, 328);
  assert.deepEqual(harborLevel.spawns, [
    { id: 'red', x: 152, y: 224, facing: 1 },
    { id: 'blue', x: 488, y: 224, facing: -1 },
  ]);
  assert.equal(harborLevel.mood.fogStrength, 0.8);
  assert.equal(harborLevel.mood.lamps.length, 2);
});
