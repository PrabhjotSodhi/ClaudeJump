import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../src/engine/config.js';
import { menuPanelSize } from '../src/ui/menu-kit.js';
import { resultsLayout } from '../src/ui/results-menu.js';

const OPTION_LABELS = ['Rematch', 'Change level', 'Change characters'];

function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

for (const playerCount of [2, 3, 4]) {
  for (const winnerIndex of [0, playerCount - 1]) {
    test(`results layout for ${playerCount} players with player ${winnerIndex} winning fits the screen on whole pixels with nothing overlapping`, () => {
      const menu = menuPanelSize(OPTION_LABELS);
      const layout = resultsLayout({ winnerIndex, playerCount, menuHeight: menu.height });
      const menuBox = {
        x: (SCREEN_WIDTH - menu.width) / 2,
        y: layout.menuTopY,
        width: menu.width,
        height: menu.height,
      };
      const hintBox = { x: 0, y: layout.hintY, width: SCREEN_WIDTH, height: layout.hintBottomY - layout.hintY };
      // The winner, pedestal and everyone else stand inside the stage panel by design.
      const standingBoxes = [layout.winner, layout.pedestal, ...layout.losers];
      const otherBoxes = [layout.banner, ...layout.statsPanels, menuBox, hintBox];

      assert.equal(layout.losers.length, playerCount - 1);
      assert.equal(layout.statsPanels.length, playerCount);
      for (const box of [layout.stage, ...standingBoxes, ...otherBoxes]) {
        for (const value of Object.values(box)) assert.ok(Number.isInteger(value));
        assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= SCREEN_WIDTH && box.y + box.height <= SCREEN_HEIGHT);
      }
      for (const inside of standingBoxes) {
        assert.ok(inside.x >= layout.stage.x && inside.x + inside.width <= layout.stage.x + layout.stage.width);
        assert.ok(inside.y >= layout.stage.y && inside.y + inside.height <= layout.stage.y + layout.stage.height);
      }
      const separateBoxes = [layout.stage, ...otherBoxes];
      separateBoxes.forEach((first, firstIndex) =>
        separateBoxes.slice(firstIndex + 1).forEach((second) => assert.ok(!overlaps(first, second))),
      );
      standingBoxes.forEach((first, firstIndex) => {
        standingBoxes.slice(firstIndex + 1).forEach((second) => assert.ok(!overlaps(first, second)));
        for (const other of otherBoxes) assert.ok(!overlaps(first, other));
      });
    });
  }
}

test('with two players the loser stands on the side of the pedestal away from the winner', () => {
  const redWins = resultsLayout({ winnerIndex: 0, playerCount: 2, menuHeight: 58 });
  const blueWins = resultsLayout({ winnerIndex: 1, playerCount: 2, menuHeight: 58 });
  assert.ok(redWins.losers[0].x > redWins.pedestal.x);
  assert.ok(blueWins.losers[0].x < blueWins.pedestal.x);
});

test('with two players the stats panels keep the two sides of the screen', () => {
  const { statsPanels } = resultsLayout({ winnerIndex: 0, playerCount: 2, menuHeight: 58 });
  assert.deepEqual(
    statsPanels.map(({ x, y }) => [x, y]),
    [
      [48, 64],
      [464, 64],
    ],
  );
});
