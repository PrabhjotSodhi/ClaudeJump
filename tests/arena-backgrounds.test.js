import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { drawArenaBackground } from '../src/levels/arena-backgrounds.js';

function recordingContext() {
  const fills = [];
  return {
    fills,
    fillStyle: null,
    fillRect(x, y, width, height) {
      fills.push([this.fillStyle, x, y, width, height]);
    },
  };
}

test('every level draws its own background the same way each time', async () => {
  const drawings = [];
  for (const file of ['harbor', 'cave', 'rooftops', 'server-farm', 'cooling-towers']) {
    const { background } = JSON.parse(await readFile(new URL(`../data/levels/${file}.json`, import.meta.url), 'utf8'));
    const first = recordingContext();
    const second = recordingContext();
    drawArenaBackground(first, background);
    drawArenaBackground(second, background);
    assert.deepEqual(first.fills, second.fills);
    drawings.push(JSON.stringify(first.fills));
  }
  assert.equal(new Set(drawings).size, drawings.length);
});

test('an unknown background name is rejected', () => {
  assert.throws(() => drawArenaBackground(recordingContext(), 'moon'), /No background named moon/);
});

test('backgrounds use only palette colors', async () => {
  const palette = JSON.parse(await readFile(new URL('../data/palette.json', import.meta.url), 'utf8'));
  const paletteColors = new Set(Object.values(palette.ramps).flat());
  for (const background of ['harbor', 'cave', 'rooftops', 'server-farm', 'cooling-towers']) {
    const context = recordingContext();
    drawArenaBackground(context, background);
    for (const [color] of context.fills) assert.ok(paletteColors.has(color), `${background} uses ${color}`);
  }
});
