import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getInputDevice, padTypeFromId, pickInputDevice, setInputDevice } from '../src/engine/input-device.js';
import { HINT_GLYPHS } from '../src/ui/hint-glyphs.js';
import { hintItems, rowsForDevice } from '../src/ui/menu-kit.js';
import { playHintRows } from '../src/ui/play-hints.js';

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

test('a hint shows keys for the keyboard, pad glyphs for a pad and nothing for touch', () => {
  assert.deepEqual(hintItems(SELECT_HINT, 'keyboard'), [{ text: 'Enter' }]);
  assert.deepEqual(hintItems(SELECT_HINT, 'pad'), [{ glyph: 'south' }]);
  assert.deepEqual(hintItems(SELECT_HINT, 'touch'), []);
});

test('pad hints use the face button symbols of the pad type', () => {
  const hint = { keys: ['Stick', 'Enter'], pad: ['stick', 'south', 'east'], label: 'Go' };
  const glyphs = (padType) => hintItems(hint, 'pad', padType).map((item) => item.glyph);
  assert.deepEqual(glyphs('letters'), ['stick', 'letters-south', 'letters-east']);
  assert.deepEqual(glyphs('shapes'), ['stick', 'shapes-south', 'shapes-east']);
  assert.deepEqual(glyphs('generic'), ['stick', 'south', 'east']);
  for (const name of glyphs('letters').concat(glyphs('shapes'))) assert.ok(HINT_GLYPHS[name], name);
});

test('the pad type comes from the id the browser reports', () => {
  assert.equal(padTypeFromId('Xbox 360 Controller (XInput STANDARD GAMEPAD)'), 'letters');
  assert.equal(padTypeFromId('045e-0b13-Xbox Wireless Controller'), 'letters');
  assert.equal(padTypeFromId('Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)'), 'shapes');
  assert.equal(padTypeFromId('DualSense Wireless Controller'), 'shapes');
  assert.equal(padTypeFromId('Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)'), 'generic');
  assert.equal(padTypeFromId('USB Gamepad'), 'generic');
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

test('play hints show one row per keyboard player and one pad row', () => {
  const rows = playHintRows(['red', 'blue', 'green'], { shove: true });
  assert.deepEqual(
    rows.map((row) => [row.label, row.device]),
    [
      ['Red', 'keyboard'],
      ['Blue', 'keyboard'],
      ['Pad', 'pad'],
    ],
  );
  assert.deepEqual(
    rows[2].hints.map((hint) => hint.label),
    ['Move', 'Jump', 'Shove'],
  );
  const survivalRows = playHintRows(['red'], { shove: false });
  assert.deepEqual(
    rowsForDevice(survivalRows, 'keyboard').map((row) => row.hints.map((hint) => hint.label)),
    [['Move', 'Jump']],
  );
});
