import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONTROLS_PANEL_WIDTH, fitPortraitLayout } from '../src/engine/portrait-layout.js';

const PHONES = [
  { name: '390x844', width: 390, height: 844, devicePixelRatio: 3 },
  { name: '412x915', width: 412, height: 915, devicePixelRatio: 3 },
  { name: '360x800', width: 360, height: 800, devicePixelRatio: 2 },
];
const NOTCH = { left: 0, right: 0, top: 47, bottom: 34 };

function layoutFor(phone, scaling, insets = NOTCH) {
  return fitPortraitLayout({ ...phone, insets, scaling });
}

function assertWholeDevicePixels(cssValue, devicePixelRatio, message) {
  const devicePixels = cssValue * devicePixelRatio;
  assert.ok(Math.abs(devicePixels - Math.round(devicePixels)) < 1e-9, message);
}

test('full scaling fills the width and keeps the 16 to 9 shape of the game', () => {
  for (const phone of PHONES) {
    const { game } = layoutFor(phone, 'full');
    assert.equal(game.deviceWidth, phone.width * phone.devicePixelRatio, phone.name);
    assert.ok(Math.abs(game.deviceHeight - (game.deviceWidth * 9) / 16) <= 0.5, phone.name);
    assert.equal(game.cssLeft, 0);
  }
});

test('crisp scaling uses a whole number of device pixels per game pixel and is centered', () => {
  for (const phone of PHONES) {
    const { game } = layoutFor(phone, 'crisp');
    const scale = game.deviceWidth / 640;
    assert.ok(Number.isInteger(scale) && scale >= 1, phone.name);
    assert.equal(game.deviceHeight, 360 * scale);
    assert.ok(game.deviceWidth <= phone.width * phone.devicePixelRatio, phone.name);
    const rightGap = phone.width - game.cssLeft - game.cssWidth;
    assert.ok(Math.abs(game.cssLeft - rightGap) <= 1 / phone.devicePixelRatio, phone.name);
  }
});

test('crisp scaling leaves the game at about 55 percent of the width on a 390 point phone', () => {
  const { game } = layoutFor(PHONES[0], 'crisp');
  assert.ok(game.cssWidth / 390 > 0.5 && game.cssWidth / 390 < 0.6);
});

test('the controls panel sits below the game and stays out of the safe areas', () => {
  for (const phone of PHONES) {
    for (const scaling of ['full', 'crisp']) {
      const { game, controls } = layoutFor(phone, scaling);
      assert.ok(game.cssTop >= NOTCH.top, `${phone.name} ${scaling}`);
      assert.ok(controls.cssTop >= game.cssTop + game.cssHeight, `${phone.name} ${scaling}`);
      assert.ok(controls.cssTop + controls.cssHeight <= phone.height - NOTCH.bottom + 1e-9, `${phone.name} ${scaling}`);
    }
  }
});

test('side safe areas keep the game and the panel inside the free width', () => {
  const insets = { left: 44, right: 44, top: 0, bottom: 0 };
  for (const scaling of ['full', 'crisp']) {
    const { game, controls } = layoutFor(PHONES[0], scaling, insets);
    for (const rectangle of [game, controls]) {
      assert.ok(rectangle.cssLeft >= 44 - 1e-9, scaling);
      assert.ok(rectangle.cssLeft + rectangle.cssWidth <= 390 - 44 + 1e-9, scaling);
    }
  }
});

test('the panel is drawn at a whole number of device pixels per panel pixel', () => {
  for (const phone of PHONES) {
    const { controls } = layoutFor(phone, 'full');
    assert.ok(Number.isInteger(controls.scale), phone.name);
    assert.equal(controls.logicalWidth, CONTROLS_PANEL_WIDTH);
    assert.equal(controls.cssWidth * phone.devicePixelRatio, CONTROLS_PANEL_WIDTH * controls.scale);
    assert.equal(controls.cssHeight * phone.devicePixelRatio, controls.logicalHeight * controls.scale);
  }
});

test('every edge lands on a whole device pixel', () => {
  for (const phone of [...PHONES, { name: 'dpr 2.75', width: 393, height: 851, devicePixelRatio: 2.75 }]) {
    for (const scaling of ['full', 'crisp']) {
      const { game, controls } = layoutFor(phone, scaling);
      for (const cssValue of [game.cssWidth, game.cssHeight, game.cssLeft, game.cssTop]) {
        assertWholeDevicePixels(cssValue, phone.devicePixelRatio, `${phone.name} ${scaling} game`);
      }
      for (const cssValue of [controls.cssWidth, controls.cssHeight, controls.cssLeft, controls.cssTop]) {
        assertWholeDevicePixels(cssValue, phone.devicePixelRatio, `${phone.name} ${scaling} panel`);
      }
    }
  }
});

test('the panel is tall enough for thumbs on the two phone sizes in the ticket', () => {
  for (const phone of PHONES.slice(0, 2)) {
    const { controls } = layoutFor(phone, 'full');
    assert.ok(controls.logicalHeight >= 100, phone.name);
  }
});
