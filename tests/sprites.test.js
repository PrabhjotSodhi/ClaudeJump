import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { gridToPixels } from '../src/engine/sprites.js';

const colors = { '.': null, o: '#3e2731', b: '#f77622' };

test('a sprite grid turns into the right pixels', () => {
  const { width, height, data } = gridToPixels(['.o', 'bo'], colors);

  assert.equal(width, 2);
  assert.equal(height, 2);
  assert.deepEqual([...data.slice(0, 4)], [0, 0, 0, 0]);
  assert.deepEqual([...data.slice(4, 8)], [0x3e, 0x27, 0x31, 255]);
  assert.deepEqual([...data.slice(8, 12)], [0xf7, 0x76, 0x22, 255]);
  assert.deepEqual([...data.slice(12, 16)], [0x3e, 0x27, 0x31, 255]);
});

test('a grid with an unknown key or a ragged row is rejected', () => {
  assert.throws(() => gridToPixels(['.x'], colors), /not in the color map/);
  assert.throws(() => gridToPixels(['..', '.'], colors), /expected 2/);
});

test('every shipped sprite frame is a valid grid of palette colors', async () => {
  const palette = JSON.parse(await readFile(new URL('../data/palette.json', import.meta.url), 'utf8'));
  const paletteColors = new Set(Object.values(palette.ramps).flat());
  for (const file of ['claude', 'muse', 'chatgpt', 'gemini', 'grok', 'deepseek', 'mistral', 'tiles', 'props']) {
    const { colors: colorByKey, frames } = JSON.parse(
      await readFile(new URL(`../data/sprites/${file}.json`, import.meta.url), 'utf8'),
    );
    for (const color of Object.values(colorByKey)) assert.ok(color === null || paletteColors.has(color), color);
    for (const rows of Object.values(frames)) gridToPixels(rows, colorByKey);
  }
});
