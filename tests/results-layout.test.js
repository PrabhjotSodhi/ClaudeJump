import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../src/engine/config.js';
import { menuPanelSize } from '../src/ui/menu-kit.js';
import { resultsLayout } from '../src/ui/results-menu.js';

const OPTION_LABELS = ['Rematch', 'Change level', 'Change characters'];

function overlaps(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

for (const winnerIndex of [0, 1]) {
  test(`results layout with player ${winnerIndex} winning fits the screen on whole pixels with nothing overlapping`, () => {
    const menu = menuPanelSize(OPTION_LABELS);
    const layout = resultsLayout({ winnerIndex, menuHeight: menu.height });
    const menuBox = { x: (SCREEN_WIDTH - menu.width) / 2, y: layout.menuTopY, width: menu.width, height: menu.height };
    const hintBox = { x: 0, y: layout.hintY, width: SCREEN_WIDTH, height: layout.hintBottomY - layout.hintY };
    const boxes = [
      layout.banner,
      layout.stage,
      layout.winner,
      layout.pedestal,
      layout.loser,
      ...layout.statsPanels,
      menuBox,
      hintBox,
    ];

    for (const box of boxes) {
      for (const value of Object.values(box)) assert.ok(Number.isInteger(value));
      assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= SCREEN_WIDTH && box.y + box.height <= SCREEN_HEIGHT);
    }
    // The winner, pedestal and loser all sit inside the stage panel by design.
    const stageIndex = 1;
    const standingPairs = new Set(['1,2', '1,3', '1,4']);
    for (const inside of [layout.winner, layout.pedestal, layout.loser]) {
      assert.ok(inside.x >= layout.stage.x && inside.x + inside.width <= layout.stage.x + layout.stage.width);
      assert.ok(inside.y >= layout.stage.y && inside.y + inside.height <= layout.stage.y + layout.stage.height);
    }
    assert.equal(boxes[stageIndex], layout.stage);
    boxes.forEach((first, firstIndex) =>
      boxes.forEach((second, secondIndex) => {
        if (secondIndex <= firstIndex || standingPairs.has(`${firstIndex},${secondIndex}`)) return;
        assert.ok(!overlaps(first, second), `box ${firstIndex} overlaps box ${secondIndex}`);
      }),
    );
  });
}

test('the loser stands on the side of the pedestal away from the winner', () => {
  const redWins = resultsLayout({ winnerIndex: 0, menuHeight: 58 });
  const blueWins = resultsLayout({ winnerIndex: 1, menuHeight: 58 });
  assert.ok(redWins.loser.x > redWins.pedestal.x);
  assert.ok(blueWins.loser.x < blueWins.pedestal.x);
});
