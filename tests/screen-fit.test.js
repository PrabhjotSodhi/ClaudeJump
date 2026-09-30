import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isPortraitOnTouchDevice, pickScale } from '../src/engine/screen-fit.js';

test('the scale is a whole number of device pixels that fits the window', () => {
  assert.equal(pickScale({ width: 1280, height: 720, devicePixelRatio: 1 }), 2);
  assert.equal(pickScale({ width: 844, height: 390, devicePixelRatio: 3 }), 3);
});

test('safe-area insets shrink the space the canvas may use', () => {
  const insets = { left: 47, right: 47, top: 0, bottom: 40 };
  assert.equal(pickScale({ width: 844, height: 390, devicePixelRatio: 3, insets }), 2);
});

test('the scale never drops below one', () => {
  assert.equal(pickScale({ width: 100, height: 100, devicePixelRatio: 1 }), 1);
});

test('only a touch device held upright counts as portrait', () => {
  assert.equal(isPortraitOnTouchDevice({ width: 390, height: 844, hasCoarsePointer: true }), true);
  assert.equal(isPortraitOnTouchDevice({ width: 844, height: 390, hasCoarsePointer: true }), false);
  assert.equal(isPortraitOnTouchDevice({ width: 600, height: 900, hasCoarsePointer: false }), false);
});
