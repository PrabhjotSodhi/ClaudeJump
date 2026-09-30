import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitScreen, isPortraitOnTouchDevice, pickScale } from '../src/engine/screen-fit.js';

test('the scale is a whole number of device pixels that fits the window', () => {
  assert.equal(pickScale({ width: 1280, height: 720, devicePixelRatio: 1 }), 2);
  assert.equal(pickScale({ width: 844, height: 390, devicePixelRatio: 3 }), 3);
});

test('safe-area insets shrink the space the canvas may use', () => {
  const insets = { left: 47, right: 47, top: 0, bottom: 40 };
  assert.equal(pickScale({ width: 844, height: 390, devicePixelRatio: 3, insets }), 2);
});

test('another logical size can be fitted, such as the portrait rotate prompt', () => {
  const portraitPhone = { width: 390, height: 844, devicePixelRatio: 3, logicalWidth: 120, logicalHeight: 160 };
  assert.equal(pickScale(portraitPhone), 9);
});

test('the scale never drops below one', () => {
  assert.equal(pickScale({ width: 100, height: 100, devicePixelRatio: 1 }), 1);
});

test('only a touch device held upright counts as portrait', () => {
  assert.equal(isPortraitOnTouchDevice({ width: 390, height: 844, hasCoarsePointer: true }), true);
  assert.equal(isPortraitOnTouchDevice({ width: 844, height: 390, hasCoarsePointer: true }), false);
  assert.equal(isPortraitOnTouchDevice({ width: 600, height: 900, hasCoarsePointer: false }), false);
});

const WINDOW_SIZES = [
  [1280, 720],
  [1366, 768],
  [1920, 1080],
  [2560, 1440],
];
const DEVICE_PIXEL_RATIOS = [1, 1.25, 1.5, 2, 3];

test('every game pixel covers a whole number of device pixels at every zoom and window size', () => {
  for (const [width, height] of WINDOW_SIZES) {
    for (const devicePixelRatio of DEVICE_PIXEL_RATIOS) {
      const fit = fitScreen({ width, height, devicePixelRatio });
      assert.ok(Number.isInteger(fit.scale), `${width}x${height} at ${devicePixelRatio}`);
      assert.equal(fit.deviceWidth, 640 * fit.scale);
      assert.equal(fit.deviceHeight, 360 * fit.scale);
      assert.ok(fit.deviceWidth <= width * devicePixelRatio + 1e-9);
      assert.ok(fit.deviceHeight <= height * devicePixelRatio + 1e-9);
    }
  }
});

test('the canvas CSS size and position land on whole device pixels', () => {
  for (const [width, height] of WINDOW_SIZES) {
    for (const devicePixelRatio of DEVICE_PIXEL_RATIOS) {
      const fit = fitScreen({ width, height, devicePixelRatio });
      for (const cssValue of [fit.cssWidth, fit.cssHeight, fit.cssLeft, fit.cssTop]) {
        const devicePixels = cssValue * devicePixelRatio;
        assert.ok(
          Math.abs(devicePixels - Math.round(devicePixels)) < 1e-9,
          `${cssValue} css px at ${devicePixelRatio}`,
        );
      }
    }
  }
});

test('a css pixel rule would give uneven pixels where the device pixel rule stays even', () => {
  const cssScale = Math.floor(Math.min(1920 / 640, 1080 / 360));
  assert.equal(cssScale * 1.25, 3.75, 'the css rule spreads a game pixel over 3.75 device pixels');
  const fit = fitScreen({ width: 1920, height: 1080, devicePixelRatio: 1.25 });
  assert.equal(fit.scale, 3);
});

test('a window that does not divide evenly centers the canvas on a device pixel', () => {
  const fit = fitScreen({ width: 1367, height: 769, devicePixelRatio: 1 });
  assert.equal(fit.scale, 2);
  assert.equal(fit.cssLeft, 44);
  assert.equal(fit.cssTop, 25);
});

test('safe-area insets move the canvas as well as shrinking the room for it', () => {
  const insets = { left: 47, right: 47, top: 0, bottom: 40 };
  const fit = fitScreen({ width: 844, height: 390, devicePixelRatio: 3, insets });
  assert.equal(fit.scale, 2);
  assert.ok(fit.cssLeft >= 47);
  assert.ok(fit.cssTop + fit.cssHeight <= 350 + 1e-9);
});
