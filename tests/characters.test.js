import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CHARACTERS, DEFAULT_CHARACTER_BY_PLAYER_ID } from '../src/entities/characters.js';
import { EYE_SIZE } from '../src/vfx/googly-eyes.js';

test('every character has its tag color, and two eyes', () => {
  const tagColorByName = Object.fromEntries(CHARACTERS.map((character) => [character.name, character.tagColor]));

  assert.deepEqual(tagColorByName, {
    claude: '#f77622',
    meta: '#b55088',
    chatgpt: '#f6757a',
    gemini: '#0099db',
    grok: '#c0cbdc',
    deepseek: '#2ce8f5',
    mistral: '#fee761',
  });
  for (const character of CHARACTERS) assert.equal(character.eyeFramePositions.length, 2, character.name);
});

test('red defaults to Claude and blue to Meta AI', () => {
  assert.equal(DEFAULT_CHARACTER_BY_PLAYER_ID.red.name, 'claude');
  assert.equal(DEFAULT_CHARACTER_BY_PLAYER_ID.blue.name, 'meta');
});

// The empty pixels the outside cannot reach without crossing the body, grouped into separate holes.
function holesOf(rows) {
  const size = rows.length;
  const reached = new Set();
  const holes = [];
  const fill = (startX, startY) => {
    const pixels = [];
    const queue = [[startX, startY]];
    while (queue.length > 0) {
      const [x, y] = queue.pop();
      const key = `${x},${y}`;
      if (x < 0 || y < 0 || x >= size || y >= size || reached.has(key) || rows[y][x] !== '.') continue;
      reached.add(key);
      pixels.push([x, y]);
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return pixels;
  };
  for (let index = 0; index < size; index++) {
    for (const [x, y] of [
      [index, 0],
      [index, size - 1],
      [0, index],
      [size - 1, index],
    ])
      fill(x, y);
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hole = fill(x, y);
      if (hole.length > 0) holes.push(hole);
    }
  }
  return holes;
}

test('Meta AI is a ribbon with two open loops that its eyes leave clear', () => {
  const rows = JSON.parse(readFileSync(new URL('../data/sprites/meta.json', import.meta.url), 'utf8')).frames.body;
  const holes = holesOf(rows);
  assert.equal(holes.length, 2, 'two loops');
  const meta = CHARACTERS.find((character) => character.name === 'meta');
  for (const [x, y] of holes.flat()) {
    for (const [eyeX, eyeY] of meta.eyeFramePositions) {
      const underEye = x >= eyeX && x < eyeX + EYE_SIZE && y >= eyeY && y < eyeY + EYE_SIZE;
      assert.ok(!underEye, `an eye covers the loop at ${x},${y}`);
    }
  }
});
