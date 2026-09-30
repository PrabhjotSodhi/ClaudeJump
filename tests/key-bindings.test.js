import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';
import {
  assignKey,
  boundCode,
  initKeyBindings,
  keyCapture,
  loadKeyBindings,
  resetKeyBindings,
  saveKeyBindings,
} from '../src/engine/key-bindings.js';
import { ControlsMenu } from '../src/ui/controls-menu.js';
import { hintItems } from '../src/ui/menu-kit.js';

const keyMappings = JSON.parse(readFileSync(new URL('../data/config/key-mappings.json', import.meta.url)));

function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

const throwingStorage = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
};

beforeEach(() => {
  keyCapture.stop();
  initKeyBindings(structuredClone(keyMappings));
});

test('assigning a key changes that control and the menu control it drives', () => {
  assert.deepEqual(assignKey('red', 'jump', 'KeyE'), { ok: true });
  assert.equal(boundCode('red', 'jump'), 'KeyE');
  assert.equal(boundCode('red', 'up'), 'KeyE');
  assert.equal(boundCode('blue', 'jump'), 'ArrowUp');
});

test('a key the other player uses is refused and nothing changes', () => {
  const result = assignKey('red', 'left', 'ArrowLeft');
  assert.equal(result.ok, false);
  assert.match(result.message, /already Blue left/i);
  assert.equal(boundCode('red', 'left'), 'KeyA');
});

test('a key another control of the same player uses is refused', () => {
  assert.equal(assignKey('red', 'left', 'KeyD').ok, false);
  assert.equal(boundCode('red', 'left'), 'KeyA');
});

test('assigning the key a control already has is fine', () => {
  assert.deepEqual(assignKey('blue', 'right', 'ArrowRight'), { ok: true });
});

test('Escape and the menu confirm keys cannot be assigned', () => {
  for (const code of ['Escape', 'Enter', 'Space']) assert.equal(assignKey('red', 'left', code).ok, false);
  assert.equal(boundCode('red', 'left'), 'KeyA');
  assert.equal(boundCode('red', 'pause'), 'Escape');
});

test('reset brings every default key back', () => {
  assignKey('red', 'left', 'KeyJ');
  assignKey('blue', 'action', 'KeyK');
  resetKeyBindings();
  assert.deepEqual(keyBindingsSnapshot(), keyMappings);
});

function keyBindingsSnapshot() {
  return ['red', 'blue'].map((id) => ({
    id,
    keys: Object.fromEntries(Object.keys(keyMappings[0].keys).map((control) => [control, boundCode(id, control)])),
  }));
}

test('saved keys load back', () => {
  const storage = fakeStorage();
  assignKey('red', 'left', 'KeyJ');
  assignKey('blue', 'jump', 'KeyP');
  saveKeyBindings(storage);
  initKeyBindings(structuredClone(keyMappings));
  loadKeyBindings(storage);
  assert.equal(boundCode('red', 'left'), 'KeyJ');
  assert.equal(boundCode('blue', 'jump'), 'KeyP');
  assert.equal(boundCode('blue', 'up'), 'KeyP');
});

test('keys load the same when two players swap keys', () => {
  const storage = fakeStorage({
    'claudejump-key-bindings': JSON.stringify({
      red: { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', action: 'ArrowDown' },
      blue: { left: 'KeyA', right: 'KeyD', jump: 'KeyW', action: 'KeyS' },
    }),
  });
  loadKeyBindings(storage);
  assert.equal(boundCode('red', 'left'), 'ArrowLeft');
  assert.equal(boundCode('blue', 'left'), 'KeyA');
});

test('saved keys that clash or are invalid leave the defaults', () => {
  const clash = { left: 'KeyA', right: 'KeyA', jump: 'KeyW', action: 'KeyS' };
  const blue = { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', action: 'ArrowDown' };
  for (const saved of [{ red: clash, blue }, { red: { left: 'KeyA' }, blue }, 'nonsense']) {
    initKeyBindings(structuredClone(keyMappings));
    loadKeyBindings(fakeStorage({ 'claudejump-key-bindings': JSON.stringify(saved) }));
    assert.deepEqual(keyBindingsSnapshot(), keyMappings);
  }
  loadKeyBindings(fakeStorage({ 'claudejump-key-bindings': '{broken' }));
  assert.deepEqual(keyBindingsSnapshot(), keyMappings);
});

test('keys stay default when storage throws, and saving does not throw', () => {
  loadKeyBindings(throwingStorage);
  assert.deepEqual(keyBindingsSnapshot(), keyMappings);
  assert.doesNotThrow(() => saveKeyBindings(throwingStorage));
});

test('hints show the keys a player has bound', () => {
  const hint = {
    keys: [
      { player: 'red', control: 'left' },
      { player: 'blue', control: 'jump' },
    ],
    label: 'Go',
  };
  assert.deepEqual(hintItems(hint, 'keyboard'), [{ text: 'A' }, { text: 'Up' }]);
  assignKey('red', 'left', 'KeyJ');
  assignKey('blue', 'jump', 'Digit5');
  assert.deepEqual(hintItems(hint, 'keyboard'), [{ text: 'J' }, { text: '5' }]);
});

const noInput = { red: {}, blue: {} };

function press(control) {
  return { red: { [control]: true }, blue: {} };
}

test('the Controls screen waits for a key, assigns it and saves', () => {
  let changes = 0;
  const menu = new ControlsMenu({ onChange: () => changes++, initialInput: noInput });
  menu.update(press('confirm'));
  assert.equal(keyCapture.waiting, true);
  assert.match(menu.options[0].label, /press a key/i);

  keyCapture.code = 'KeyJ';
  menu.update(noInput);
  assert.equal(keyCapture.waiting, false);
  assert.equal(boundCode('red', 'left'), 'KeyJ');
  assert.equal(changes, 1);
  assert.equal(menu.message, '');
});

test('the Controls screen shows a message for a clash and keeps the key', () => {
  const menu = new ControlsMenu({ initialInput: noInput });
  menu.update(press('confirm'));
  keyCapture.code = 'ArrowRight';
  menu.update(noInput);
  assert.equal(boundCode('red', 'left'), 'KeyA');
  assert.match(menu.message, /already Blue right/i);
});

test('Escape cancels the wait without changing a key, and cannot be assigned', () => {
  const menu = new ControlsMenu({ initialInput: noInput });
  menu.update(press('confirm'));
  keyCapture.code = 'Escape';
  assert.equal(menu.update(noInput), false);
  assert.equal(keyCapture.waiting, false);
  assert.equal(boundCode('red', 'left'), 'KeyA');
});

test('the Reset row restores the defaults and saves', () => {
  let changes = 0;
  assignKey('red', 'left', 'KeyJ');
  const menu = new ControlsMenu({ onChange: () => changes++, initialInput: noInput });
  menu.selectedIndex = menu.options.findIndex((option) => option.id === 'reset');
  menu.update(press('confirm'));
  assert.equal(boundCode('red', 'left'), 'KeyA');
  assert.equal(changes, 1);
});

test('pause closes the Controls screen', () => {
  const menu = new ControlsMenu({ initialInput: noInput });
  assert.equal(menu.update(press('pause')), true);
});
