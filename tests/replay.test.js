import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { harborLevel } from './fixtures/harbor-level.mjs';
import { runScriptedReplay } from './fixtures/replay-script.mjs';

const baseline = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/replay-640x360.json', import.meta.url)), 'utf8'),
);

test('the 640x360 grid plays the scripted replay exactly matching the recorded baseline', () => {
  const { snapshots } = runScriptedReplay(VersusScene, harborLevel);

  assert.equal(snapshots.length, baseline.length);
  for (let index = 0; index < baseline.length; index++) {
    const expected = baseline[index];
    const actual = snapshots[index];
    assert.equal(actual.tick, expected.tick);
    for (const playerId of ['red', 'blue']) {
      assert.equal(actual[playerId].x, expected[playerId].x, `tick ${expected.tick} ${playerId}.x`);
      assert.equal(actual[playerId].y, expected[playerId].y, `tick ${expected.tick} ${playerId}.y`);
    }
  }
});
