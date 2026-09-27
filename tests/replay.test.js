import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { runScriptedReplay } from './fixtures/replay-script.mjs';

const baseline = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/replay-320x180.json', import.meta.url)), 'utf8'),
);

test('the 640x360 grid plays the scripted replay exactly twice the 320x180 baseline', () => {
  const { snapshots } = runScriptedReplay(VersusScene);

  assert.equal(snapshots.length, baseline.length);
  for (let index = 0; index < baseline.length; index++) {
    const expected = baseline[index];
    const actual = snapshots[index];
    assert.equal(actual.tick, expected.tick);
    for (const playerId of ['red', 'blue']) {
      assert.equal(actual[playerId].x, expected[playerId].x * 2, `tick ${expected.tick} ${playerId}.x`);
      assert.equal(actual[playerId].y, expected[playerId].y * 2, `tick ${expected.tick} ${playerId}.y`);
    }
  }
});
