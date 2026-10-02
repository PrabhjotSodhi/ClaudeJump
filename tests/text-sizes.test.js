import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { TEXT_SCALES } from '../src/ui/text.js';

function sourceFiles(folder) {
  return readdirSync(folder, { recursive: true })
    .filter((name) => name.endsWith('.js'))
    .map((name) => `${folder}/${name}`);
}

test('the whole UI uses at most four text sizes', () => {
  assert.ok(TEXT_SCALES.length <= 4);
  const files = [...sourceFiles('src/ui'), ...sourceFiles('src/scenes')];
  const found = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/scale: (\d+)|SCALES? = \[?([\d, ]+)\]?;/g)) {
      for (const value of (match[1] ?? match[2]).split(',')) found.push({ file, scale: Number(value) });
    }
  }
  assert.ok(found.length > 10);
  for (const { file, scale } of found) assert.ok(TEXT_SCALES.includes(scale), `${file} uses scale ${scale}`);
});
