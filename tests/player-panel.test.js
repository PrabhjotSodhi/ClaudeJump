import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCREEN_WIDTH } from '../src/engine/config.js';
import { PLAYER_PANEL_BOTTOM, playerPanelBoxes } from '../src/ui/player-panel.js';
import { TIMER_PANEL, TIMER_PANEL_URGENT } from '../src/ui/hud.js';
import { arenaLevels } from './fixtures/arena-levels.mjs';

function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

test('two players keep a panel in each top corner', () => {
  const [left, right] = playerPanelBoxes(2);

  assert.deepEqual([left.x, left.y, left.side], [8, 8, 'left']);
  assert.deepEqual([right.x + right.width, right.y, right.side], [SCREEN_WIDTH - 8, 8, 'right']);
});

for (const playerCount of [2, 3, 4]) {
  test(`${playerCount} panels fit on whole pixels without touching each other or the timer`, () => {
    const boxes = playerPanelBoxes(playerCount);

    assert.equal(boxes.length, playerCount);
    boxes.forEach((box, index) => {
      for (const value of [box.x, box.y, box.width, box.height]) assert.ok(Number.isInteger(value));
      assert.ok(box.x >= 0 && box.x + box.width <= SCREEN_WIDTH);
      assert.ok(box.y + box.height <= PLAYER_PANEL_BOTTOM);
      for (const timerBox of [TIMER_PANEL, TIMER_PANEL_URGENT])
        assert.ok(!overlaps(box, timerBox), `panel ${index} covers the timer`);
      boxes.slice(index + 1).forEach((other) => assert.ok(!overlaps(box, other), `panel ${index} overlaps another`));
    });
  });
}

test('the first player is leftmost and the panels run left to right in seat order', () => {
  for (const playerCount of [2, 3, 4]) {
    const xs = playerPanelBoxes(playerCount).map((box) => box.x);
    assert.deepEqual(
      xs,
      [...xs].sort((first, second) => first - second),
    );
  }
});

test('panels cover no block or spawn in any arena, only hanging chains', () => {
  for (const [name, level] of Object.entries(arenaLevels)) {
    const boxes = [
      ...playerPanelBoxes(2),
      ...playerPanelBoxes(3),
      ...playerPanelBoxes(4),
      TIMER_PANEL,
      TIMER_PANEL_URGENT,
    ];
    for (const box of boxes) {
      const coveredTiles = level.tiles.filter(
        (tile) => tile.name !== 'chain' && overlaps(box, { x: tile.x, y: tile.y, width: 16, height: 16 }),
      );
      assert.deepEqual(coveredTiles, [], `${name} has a block under a panel`);
      for (const spawn of level.spawns)
        assert.ok(spawn.y > box.y + box.height, `${name} ${spawn.id} spawns under a panel`);
    }
  }
});

test('the timer grows for the last seconds and stays centered on whole pixels', () => {
  assert.ok(TIMER_PANEL_URGENT.width > TIMER_PANEL.width && TIMER_PANEL_URGENT.height > TIMER_PANEL.height);
  for (const box of [TIMER_PANEL, TIMER_PANEL_URGENT]) {
    assert.ok(Number.isInteger(box.x) && Number.isInteger(box.width));
    assert.equal(box.x + box.width / 2, SCREEN_WIDTH / 2);
  }
});
