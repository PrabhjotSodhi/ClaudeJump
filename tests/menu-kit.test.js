import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCREEN_WIDTH } from '../src/engine/config.js';
import {
  bobOffset,
  MENU_BOB_HALF_PERIOD_TICKS,
  MENU_SLIDE_DISTANCE,
  MENU_SLIDE_TICKS,
  MenuMotion,
  menuPanelSize,
  menuRowRectangles,
  pressSquashPixels,
  rowIndexAt,
  wrapMenuIndex,
} from '../src/ui/menu-kit.js';
import { TitleScene } from '../src/scenes/title-scene.js';
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

function slideOffsets(motion, ticks) {
  const offsets = [];
  for (let tick = 0; tick < ticks; tick++) {
    offsets.push(motion.offsetY);
    motion.update();
  }
  return offsets;
}

test('a new menu starts fully offset and settles in exactly the slide time', () => {
  const offsets = slideOffsets(new MenuMotion(), MENU_SLIDE_TICKS + 2);

  assert.equal(offsets[0], MENU_SLIDE_DISTANCE);
  assert.equal(offsets[MENU_SLIDE_TICKS], 0);
  assert.equal(offsets[MENU_SLIDE_TICKS + 1], 0);
});

test('the slide in moves in whole pixels, never backwards, and eases out', () => {
  const offsets = slideOffsets(new MenuMotion(), MENU_SLIDE_TICKS + 1);

  assert.ok(offsets.every(Number.isInteger));
  for (let index = 1; index < offsets.length; index++) assert.ok(offsets[index] <= offsets[index - 1]);
  assert.ok(offsets[0] - offsets[1] > offsets[MENU_SLIDE_TICKS - 1] - offsets[MENU_SLIDE_TICKS]);
});

test('closing slides the menu back out over the same time and then reports closed', () => {
  const motion = new MenuMotion();
  for (let tick = 0; tick < 30; tick++) motion.update();
  motion.close();

  const offsets = slideOffsets(motion, MENU_SLIDE_TICKS + 1);

  assert.equal(offsets[0], 0);
  assert.equal(offsets[MENU_SLIDE_TICKS], MENU_SLIDE_DISTANCE);
  assert.ok(offsets.every(Number.isInteger));
  assert.equal(motion.isClosed, true);
});

test('a menu made closed starts hidden', () => {
  const motion = new MenuMotion({ closed: true });
  motion.update();

  assert.equal(motion.isClosed, true);
  assert.equal(motion.offsetY, MENU_SLIDE_DISTANCE);
});

test('a menu that is still open is not closed', () => {
  const motion = new MenuMotion();
  for (let tick = 0; tick < 100; tick++) motion.update();

  assert.equal(motion.isClosed, false);
});

test('a press squashes the selection for a few ticks and then releases it', () => {
  const motion = new MenuMotion();
  assert.equal(motion.squashPixels, 0);

  motion.press();
  const squashes = [];
  for (let tick = 0; tick < 10; tick++) {
    squashes.push(motion.squashPixels);
    motion.update();
  }

  assert.ok(squashes[0] > 0);
  assert.ok(squashes[0] >= squashes[3]);
  assert.equal(squashes[9], 0);
  assert.ok(squashes.filter((squash) => squash > 0).length >= 3);
  assert.equal(pressSquashPixels(100), 0);
});

test('the selected item bobs up one pixel and back, half a period at a time', () => {
  assert.equal(bobOffset(0), 0);
  assert.equal(bobOffset(MENU_BOB_HALF_PERIOD_TICKS - 1), 0);
  assert.equal(bobOffset(MENU_BOB_HALF_PERIOD_TICKS), -1);
  assert.equal(bobOffset(2 * MENU_BOB_HALF_PERIOD_TICKS), 0);
});

test('a confirm press during the slide in still chooses the option', () => {
  const chosen = [];
  const scene = new TitleScene({ options: [{ id: 'versus', label: 'Versus' }] });
  scene.events.on('menu-selected', () => chosen.push('selected'));
  scene.sceneManager = { setScene() {} };
  scene.update({ red: {} });

  scene.update({ red: { confirm: true } });

  assert.ok(scene.menuMotion.offsetY > 0);
  assert.deepEqual(chosen, ['selected']);
  assert.ok(scene.menuMotion.squashPixels > 0);
});
