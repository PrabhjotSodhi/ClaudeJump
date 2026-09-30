import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONTROLS_PANEL_WIDTH, fitPortraitLayout } from '../src/engine/portrait-layout.js';

const PHONES = [
  { name: '390x844', width: 390, height: 844, devicePixelRatio: 3 },
  { name: '412x915', width: 412, height: 915, devicePixelRatio: 3 },
  { name: '360x800', width: 360, height: 800, devicePixelRatio: 2 },
  { name: 'dpr 2.75', width: 393, height: 851, devicePixelRatio: 2.75 },
];
const NOTCH = { left: 0, right: 0, top: 47, bottom: 34 };

function layoutFor(phone, insets = NOTCH) {
  return fitPortraitLayout({ ...phone, insets });
}

test('the game fills the width and keeps the 16 to 9 shape', () => {
  for (const phone of PHONES) {
    const { game } = layoutFor(phone);
    assert.equal(game.deviceWidth, Math.floor(phone.width * phone.devicePixelRatio), phone.name);
    assert.ok(Math.abs(game.deviceHeight - (game.deviceWidth * 9) / 16) <= 0.5, phone.name);
    assert.equal(game.cssLeft, 0);
  }
});

test('the game sits below the top safe area and the panel directly under the game', () => {
  for (const phone of PHONES) {
    const { game, controls } = layoutFor(phone);
    const gap = controls.cssTop - (game.cssTop + game.cssHeight);
    assert.ok(game.cssTop >= NOTCH.top, phone.name);
    assert.ok(gap >= 0 && gap < 12 + controls.scale / phone.devicePixelRatio, `${phone.name} gap ${gap}`);
  }
});

test('the panel fills the rest of the screen down to the bottom safe area', () => {
  for (const phone of PHONES) {
    const { controls } = layoutFor(phone);
    const bottom = controls.cssTop + controls.cssHeight;
    assert.ok(Math.abs(bottom - (phone.height - NOTCH.bottom)) < 1 / phone.devicePixelRatio, phone.name);
  }
});

test('side safe areas keep the game and the panel inside the free width', () => {
  const insets = { left: 44, right: 44, top: 0, bottom: 0 };
  const { game, controls } = layoutFor(PHONES[0], insets);
  for (const rectangle of [game, controls]) {
    assert.ok(rectangle.cssLeft >= 44 - 1e-9);
    assert.ok(rectangle.cssLeft + rectangle.cssWidth <= 390 - 44 + 1e-9);
  }
});

test('the panel is drawn at a whole number of device pixels per panel pixel', () => {
  for (const phone of PHONES) {
    const { controls } = layoutFor(phone);
    assert.ok(Number.isInteger(controls.scale), phone.name);
    assert.equal(controls.logicalWidth, CONTROLS_PANEL_WIDTH);
    assert.ok(Math.abs(controls.cssWidth * phone.devicePixelRatio - CONTROLS_PANEL_WIDTH * controls.scale) < 1e-9);
    assert.ok(Math.abs(controls.cssHeight * phone.devicePixelRatio - controls.logicalHeight * controls.scale) < 1e-9);
  }
});

test('every edge lands on a whole device pixel', () => {
  for (const phone of PHONES) {
    const { game, controls } = layoutFor(phone);
    const cssValues = [
      ...[game.cssWidth, game.cssHeight, game.cssLeft, game.cssTop],
      ...[controls.cssWidth, controls.cssHeight, controls.cssLeft, controls.cssTop],
    ];
    for (const cssValue of cssValues) {
      const devicePixels = cssValue * phone.devicePixelRatio;
      assert.ok(Math.abs(devicePixels - Math.round(devicePixels)) < 1e-9, `${phone.name} ${cssValue}`);
    }
  }
});

test('the panel is tall enough for thumbs on the two phone sizes in the ticket', () => {
  for (const phone of PHONES.slice(0, 2)) {
    assert.ok(layoutFor(phone).controls.logicalHeight >= 100, phone.name);
  }
});
