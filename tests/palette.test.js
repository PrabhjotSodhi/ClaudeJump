import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { buildLookupTexture, paletteColors, stepDownRamp } from '../src/engine/palette.js';

const palette = JSON.parse(await readFile(new URL('../data/palette.json', import.meta.url), 'utf8'));

test('the palette loads with every ramp from the art direction, dark to light', () => {
  assert.deepEqual(Object.keys(palette.ramps), [
    'outline',
    'warmGrey',
    'coolGrey',
    'skin',
    'orange',
    'red',
    'green',
    'blue',
    'purple',
  ]);
  assert.deepEqual(palette.ramps.orange, ['#be4a2f', '#d77643', '#f77622', '#feae34', '#fee761']);
  assert.deepEqual(palette.ramps.warmGrey, ['#585050', '#a09088', '#c8c0b8']);
  assert.equal(paletteColors(palette).length, 32);
});

test('a color steps down its own ramp by the number of steps', () => {
  assert.equal(stepDownRamp(palette, '#f77622', 0), '#f77622');
  assert.equal(stepDownRamp(palette, '#f77622', 1), '#d77643');
  assert.equal(stepDownRamp(palette, '#fee761', 3), '#d77643');
  assert.equal(stepDownRamp(palette, '#c8c0b8', 2), '#585050');
});

test('a color at the dark end of its ramp stays put', () => {
  assert.equal(stepDownRamp(palette, '#be4a2f', 3), '#be4a2f');
  assert.equal(stepDownRamp(palette, '#a09088', 3), '#585050');
});

test('a color outside the palette is unchanged', () => {
  assert.equal(stepDownRamp(palette, '#123456', 3), '#123456');
});

test('the lookup texture holds each palette color stepped down 0 to 3 times', () => {
  const { width, height, pixels } = buildLookupTexture(palette);
  const column = paletteColors(palette).indexOf('#feae34');
  const pixelAt = (steps) => [...pixels.slice((steps * width + column) * 4, (steps * width + column) * 4 + 4)];

  assert.equal(height, 4);
  assert.deepEqual(pixelAt(0), [0xfe, 0xae, 0x34, 255]);
  assert.deepEqual(pixelAt(1), [0xf7, 0x76, 0x22, 255]);
  assert.deepEqual(pixelAt(3), [0xbe, 0x4a, 0x2f, 255]);
});
