import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { spriteFileToPixels } from '../src/engine/sprites.js';
import { LEVEL_COLUMNS, LEVEL_ROWS, SCREEN_HEIGHT, SCREEN_WIDTH } from '../src/engine/config.js';
import { PLAYER_WIDTH } from '../src/entities/player.js';
import { buildLevel, stoneColorOverrides } from '../src/levels/level-loader.js';
import { arenaLevels } from './fixtures/arena-levels.mjs';
import { harborLevel } from './fixtures/harbor-level.mjs';

function levelWithTiles(tilesByRow) {
  const grid = Array.from({ length: LEVEL_ROWS }, (_, row) => (tilesByRow[row] ?? '').padEnd(LEVEL_COLUMNS, '.'));
  return { name: 'Test', grid, spawns: [], waterLineY: 300 };
}

test('a horizontal run of solid tiles becomes one platform', () => {
  const level = buildLevel(levelWithTiles({ 5: '...sss..' }));

  assert.deepEqual(level.platforms, [{ x: 48, y: 80, width: 48, height: 16 }]);
});

test('a gap splits a row into two platforms, and each row gets its own', () => {
  const level = buildLevel(levelWithTiles({ 2: 'ss..s', 3: 'ss' }));

  assert.deepEqual(level.platforms, [
    { x: 0, y: 32, width: 32, height: 16 },
    { x: 64, y: 32, width: 16, height: 16 },
    { x: 0, y: 48, width: 32, height: 16 },
  ]);
});

test('a run that reaches the right edge still becomes a platform', () => {
  const level = buildLevel(levelWithTiles({ 0: 's'.padStart(LEVEL_COLUMNS, '.') }));

  assert.deepEqual(level.platforms, [{ x: 624, y: 0, width: 16, height: 16 }]);
});

test('small blocks, big blocks and girders are drawn with their sprites, and a big block is one tile', () => {
  const level = buildLevel(levelWithTiles({ 1: 's.BB', 2: '..BB', 5: '.===' }));
  const chains = level.tiles.filter((tile) => tile.name === 'chain');

  assert.deepEqual(
    level.tiles.filter((tile) => tile.name !== 'chain'),
    [
      { x: 0, y: 16, name: 'block-small-1' },
      { x: 32, y: 16, name: 'block-big-1' },
      { x: 16, y: 80, name: 'girder-left' },
      { x: 32, y: 80, name: 'girder-middle' },
      { x: 48, y: 80, name: 'girder-right' },
    ],
  );
  assert.deepEqual([...new Set(chains.map((chain) => chain.x))], [22, 54]);
  assert.deepEqual(
    chains.filter((chain) => chain.x === 22).map((chain) => chain.y),
    [72, 64, 56, 48, 40, 32, 24, 16, 8, 0],
  );
});

test('a lone or broken big block is rejected with its position', () => {
  assert.throws(() => buildLevel(levelWithTiles({ 3: '.B' })), /broken big block at 1,3/);
  assert.throws(() => buildLevel(levelWithTiles({ 3: 'BB', 4: 'B' })), /broken big block at 0,3/);
  assert.throws(() => buildLevel(levelWithTiles({ 3: 'BBB', 4: 'BBB' })), /broken big block at 2,3/);
});

test('a character that is not a block or girder is rejected', () => {
  assert.throws(() => buildLevel(levelWithTiles({ 0: 'X' })), /not a block or girder/);
});

test("a level's stone colors replace the block colors but not the girder colors", async () => {
  const spriteFile = JSON.parse(await readFile(new URL('../data/sprites/blocks.json', import.meta.url), 'utf8'));
  const stone = { light: '#111111', mid: '#222222', dark: '#333333' };

  const stoneSprites = spriteFileToPixels(spriteFile, stoneColorOverrides(stone));
  const defaultSprites = spriteFileToPixels(spriteFile);

  const middleOfBlockPixel = 4 * (8 * 16 + 8);
  assert.deepEqual(
    [...stoneSprites['block-small-0'].data.slice(middleOfBlockPixel, middleOfBlockPixel + 4)],
    [0x22, 0x22, 0x22, 255],
  );
  assert.deepEqual(stoneSprites['girder-left'].data, defaultSprites['girder-left'].data);
});

test('a grid of the wrong size is rejected', () => {
  const data = levelWithTiles({});
  data.grid[0] = '.';
  assert.throws(() => buildLevel(data), /wide/);
  assert.throws(() => buildLevel({ ...levelWithTiles({}), grid: [] }), /rows/);
});

test('harbor has a girder above two block islands', () => {
  const topPlatforms = harborLevel.platforms.filter((platform) => platform.y === 144 || platform.y === 224);

  assert.deepEqual(topPlatforms, [
    { x: 256, y: 144, width: 128, height: 16 },
    { x: 80, y: 224, width: 176, height: 16 },
    { x: 272, y: 224, width: 16, height: 16 },
    { x: 416, y: 224, width: 144, height: 16 },
  ]);
});

test('harbor loads its spawns and sea line', () => {
  assert.equal(harborLevel.name, 'Harbor');
  assert.equal(harborLevel.waterLineY, 328);
  assert.deepEqual(harborLevel.spawns, [
    { id: 'red', x: 152, y: 224, facing: 1 },
    { id: 'blue', x: 488, y: 224, facing: -1 },
    { id: 'green', x: 212, y: 224, facing: 1 },
    { id: 'yellow', x: 428, y: 224, facing: -1 },
  ]);
});

test('open tops leave out tiles that have another tile anywhere above them', () => {
  const level = buildLevel(levelWithTiles({ 2: 'ssss', 5: '.ss...ss' }));

  assert.deepEqual(level.openTops, [
    { x: 0, y: 32, width: 64, height: 16 },
    { x: 96, y: 80, width: 32, height: 16 },
  ]);
});

for (const [fileName, level] of Object.entries(arenaLevels)) {
  test(`${fileName} has fair spawns standing on platforms above the sea`, () => {
    const [red, blue] = level.spawns;
    assert.deepEqual([red.id, blue.id], ['red', 'blue']);
    assert.equal(red.x, SCREEN_WIDTH - blue.x, 'each spawn is the same distance from its edge');
    assert.equal(red.y, blue.y, 'both spawns are the same height above the sea');
    assert.deepEqual([red.facing, blue.facing], [1, -1], 'both face the middle');
    for (const spawn of level.spawns) {
      const standsOnPlatform = level.platforms.some(
        (platform) =>
          platform.y === spawn.y &&
          platform.x <= spawn.x - PLAYER_WIDTH / 2 &&
          spawn.x + PLAYER_WIDTH / 2 <= platform.x + platform.width,
      );
      assert.ok(standsOnPlatform, `${spawn.id} stands on a platform`);
    }
  });

  test(`${fileName} leaves room to fight on a dry platform when the sea stops rising`, () => {
    assert.ok(level.platforms.length > 0);
    assert.ok(level.waterLineY < SCREEN_HEIGHT, 'the sea shows on screen');
    assert.ok(
      level.spawns.every((spawn) => spawn.y < level.waterLineY),
      'spawns start above the sea',
    );
    assert.ok(level.suddenDeathLineY < level.waterLineY, 'the sea rises in sudden death');
    const dryTops = level.openTops.filter((openTop) => openTop.y < level.suddenDeathLineY);
    assert.ok(
      dryTops.some((openTop) => openTop.width >= 4 * PLAYER_WIDTH),
      'a platform at least four players wide stays above the sudden death line',
    );
  });
}

test('rooftops has two fixed bounce pads and the other arenas have none', () => {
  assert.equal(arenaLevels.rooftops.bouncePads.length, 2);
  for (const fileName of ['harbor', 'cave', 'server-farm', 'cooling-towers', 'bridge', 'quarry'])
    assert.deepEqual(arenaLevels[fileName].bouncePads, []);
});
