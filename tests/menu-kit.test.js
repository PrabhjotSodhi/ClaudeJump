import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCREEN_WIDTH } from '../src/engine/config.js';
import { menuPanelSize, menuRowRectangles, rowIndexAt, wrapMenuIndex } from '../src/ui/menu-kit.js';
import { measureText } from '../src/ui/text.js';

test('the panel is wider for a longer row and taller for each extra row', () => {
  const short = menuPanelSize(['Go']);
  const long = menuPanelSize(['Go', 'Return to title']);
  assert.ok(long.width > short.width);
  assert.ok(long.width > measureText('Return to title'));
  assert.ok(long.height > short.height);
});

test('the pause menu panel fits on screen with an even width', () => {
  const { width } = menuPanelSize(['Resume', 'Return to title']);
  assert.ok(width < SCREEN_WIDTH);
  assert.equal(width % 2, 0);
});

test('selection wraps past both ends', () => {
  assert.equal(wrapMenuIndex(1, 1, 2), 0);
  assert.equal(wrapMenuIndex(0, -1, 2), 1);
  assert.equal(wrapMenuIndex(0, 1, 3), 1);
});

test('rowIndexAt finds the tapped menu row', () => {
  const rows = menuRowRectangles(['Versus', 'Survival'], 100);

  assert.equal(rowIndexAt(rows, { x: 320, y: rows[1].y + 2 }), 1);
  assert.equal(rowIndexAt(rows, { x: 320, y: 10 }), -1);
  assert.equal(rowIndexAt(rows, null), -1);
});
