import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getInputDevice, pickInputDevice, setInputDevice } from '../src/engine/input-device.js';
import { HINT_GLYPHS } from '../src/ui/hint-glyphs.js';
import { hintItems, rowsForDevice } from '../src/ui/menu-kit.js';

const idle = { keyboardHeld: false, padHeld: false, touchVisible: false };

test('the device stays the same while nothing is pressed', () => {
  assert.equal(pickInputDevice('pad', idle), 'pad');
  assert.equal(pickInputDevice('touch', { ...idle, touchVisible: true }), 'touch');
});

test('the last device to send input becomes the device in use', () => {
  let device = 'keyboard';
  device = pickInputDevice(device, { ...idle, padHeld: true });
  assert.equal(device, 'pad');
  device = pickInputDevice(device, { ...idle, touchVisible: true });
  assert.equal(device, 'touch');
  device = pickInputDevice(device, { ...idle, keyboardHeld: true });
  assert.equal(device, 'keyboard');
});

test('the device is readable and settable for the UI', () => {
  setInputDevice('pad');
  assert.equal(getInputDevice(), 'pad');
  setInputDevice('keyboard');
  assert.equal(getInputDevice(), 'keyboard');
});

const SELECT_HINT = { keys: ['Enter'], pad: ['south'], label: 'Select' };

test('a hint shows keys for the keyboard, pad glyphs for a pad and a tap icon for touch', () => {
  assert.deepEqual(hintItems(SELECT_HINT, 'keyboard'), [{ text: 'Enter' }]);
  assert.deepEqual(hintItems(SELECT_HINT, 'pad'), [{ glyph: 'south' }]);
  assert.deepEqual(hintItems(SELECT_HINT, 'touch'), [{ glyph: 'tap' }]);
});

test('every glyph is 11 by 11 pixels', () => {
  for (const rows of Object.values(HINT_GLYPHS)) {
    assert.equal(rows.length, 11);
    for (const row of rows) assert.equal(row.length, 11);
  }
});

test('hint rows for one device are hidden from the others', () => {
  const rows = [{ device: 'keyboard' }, { device: 'pad' }, {}];
  assert.deepEqual(rowsForDevice(rows, 'pad'), [{ device: 'pad' }, {}]);
  assert.deepEqual(rowsForDevice(rows, 'keyboard'), [{ device: 'keyboard' }, {}]);
  assert.deepEqual(rowsForDevice(rows, 'touch'), [{}]);
});
