import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../src/engine/config.js';
import { Platform } from '../src/entities/platform.js';
import { Crate, CRATE_HEIGHT, CRATE_WIDTH } from '../src/entities/crate.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { arenaLevels } from './fixtures/arena-levels.mjs';

const idle = { left: false, right: false, jump: false };
const crateColumns = [0, 40, 100, 217, 320, 401, 500, SCREEN_WIDTH - CRATE_WIDTH];
const seamColumns = [-12, -1, SCREEN_WIDTH - CRATE_WIDTH + 1, SCREEN_WIDTH - 4];

function fallToRest(crate, platforms) {
  for (let tick = 0; tick < SCREEN_HEIGHT; tick++) {
    crate.update(platforms);
    if (crate.landed) return { x: crate.x, y: crate.y };
  }
  return null;
}

for (const [levelName, level] of Object.entries(arenaLevels)) {
  test(`on ${levelName} the predicted landing spot is where the crate lands`, () => {
    const scene = new VersusScene({ level, startInFightPhase: true, seed: 1 });
    const platforms = scene.entityGroups.get('platforms');
    let landings = 0;

    for (const x of [...crateColumns, ...seamColumns]) {
      const crate = new Crate({ x, y: 0, cardName: 'dash' });
      crate.predictLanding(platforms);
      const predicted = crate.landing && { x: crate.landing.x, y: crate.landing.y };
      assert.deepEqual(fallToRest(crate, platforms), predicted, `crate at x ${x}`);
      if (predicted) landings++;
    }
    assert.ok(landings > 0, 'at least one column has a platform to land on');
  });

  test(`on ${levelName} every crate the scene drops lands on its predicted spot`, () => {
    const scene = new VersusScene({ level, startInFightPhase: true, seed: 3 });
    let landedCount = 0;
    let predicted = null;
    for (let tick = 0; tick < 1200 && landedCount < 2; tick++) {
      scene.update({ red: idle, blue: idle });
      const crate = scene.entityGroups.get('crates')[0];
      if (!crate) {
        predicted = null;
        continue;
      }
      predicted ??= { x: crate.landing.x, y: crate.landing.y };
      if (!crate.landed) continue;
      assert.deepEqual({ x: crate.x, y: crate.y }, predicted);
      landedCount++;
      predicted = null;
      scene.entityGroups.remove('crates', crate);
      scene.scheduleNextCrate();
    }
    assert.ok(landedCount > 0, 'a crate landed');
  });
}

test('a crate over the screen edge lands on the platform at the far side when it is higher', () => {
  const lowPlatform = new Platform({ x: SCREEN_WIDTH - 32, y: 300, width: 32, height: 32 });
  const highPlatform = new Platform({ x: 0, y: 200, width: 32, height: 32 });
  const crate = new Crate({ x: SCREEN_WIDTH - 6, y: 0, cardName: 'dash' });
  crate.predictLanding([lowPlatform, highPlatform]);

  assert.equal(crate.landing.y, highPlatform.y - CRATE_HEIGHT);
  assert.equal(crate.landing.x, SCREEN_WIDTH - 6);
});

test('a crate with nothing below it has no landing spot', () => {
  const crate = new Crate({ x: 100, y: 0, cardName: 'dash' });
  crate.predictLanding([new Platform({ x: 300, y: 200, width: 32, height: 32 })]);
  assert.equal(crate.landing, null);
});

test('the prediction follows a block breaking under the crate', () => {
  const upper = new Platform({ x: 0, y: 200, width: 100, height: 32 });
  const lower = new Platform({ x: 0, y: 300, width: 100, height: 32 });
  const crate = new Crate({ x: 10, y: 0, cardName: 'dash' });
  crate.predictLanding([upper, lower]);
  assert.equal(crate.landing.y, 200 - CRATE_HEIGHT);

  crate.update([lower]);
  assert.equal(crate.landing.y, 300 - CRATE_HEIGHT);
});
