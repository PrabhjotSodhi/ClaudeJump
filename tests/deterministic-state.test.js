import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { stateHash } from '../src/engine/state-hash.js';
import { SurvivalScene } from '../src/scenes/survival-scene.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { arenaLevels } from './fixtures/arena-levels.mjs';
import { REPLAY_SEED, scriptForTick } from './fixtures/replay-script.mjs';

const TOTAL_TICKS = 1800;
const HASH_EVERY_TICKS = 60;

function versusHashes(level) {
  const scene = new VersusScene({ level, startInFightPhase: true, seed: REPLAY_SEED });
  const hashes = [];
  for (let tick = 0; tick < TOTAL_TICKS; tick++) {
    scene.update(scriptForTick(tick));
    if ((tick + 1) % HASH_EVERY_TICKS === 0) hashes.push(stateHash(scene));
  }
  return hashes;
}

function survivalInput(tick) {
  return { red: { left: tick % 90 < 30, right: tick % 90 >= 45, jump: tick % 20 < 12 } };
}

function survivalHashes() {
  const scene = new SurvivalScene({ seed: REPLAY_SEED });
  const hashes = [];
  for (let tick = 0; tick < TOTAL_TICKS; tick++) {
    scene.update(survivalInput(tick));
    if ((tick + 1) % HASH_EVERY_TICKS === 0) hashes.push(stateHash(scene));
  }
  return hashes;
}

for (const [levelName, level] of Object.entries(arenaLevels)) {
  test(`Versus on ${levelName} replays to the same hash every ${HASH_EVERY_TICKS} ticks`, () => {
    assert.deepEqual(versusHashes(level), versusHashes(level));
  });
}

test(`Survival replays to the same hash every ${HASH_EVERY_TICKS} ticks`, () => {
  const hashes = survivalHashes();
  assert.deepEqual(hashes, survivalHashes());
  assert.ok(new Set(hashes).size > hashes.length / 2);
});

test('the hash changes as the game plays on and when the seed or the inputs differ', () => {
  const hashes = versusHashes(arenaLevels.harbor);
  assert.ok(new Set(hashes).size > hashes.length / 2);

  const sameSeed = new VersusScene({ level: arenaLevels.harbor, startInFightPhase: true, seed: REPLAY_SEED });
  const otherSeed = new VersusScene({ level: arenaLevels.harbor, startInFightPhase: true, seed: REPLAY_SEED + 1 });
  assert.notEqual(stateHash(sameSeed), stateHash(otherSeed));

  const movedRight = new VersusScene({ level: arenaLevels.harbor, startInFightPhase: true, seed: REPLAY_SEED });
  const idle = scriptForTick(0);
  sameSeed.update({ ...idle, red: { ...idle.red, right: true } });
  movedRight.update({ ...idle, red: { ...idle.red, left: true } });
  assert.notEqual(stateHash(sameSeed), stateHash(movedRight));
});

const UNSAFE_MATH =
  /Math\.(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|asinh|acosh|atanh|exp|expm1|log|log2|log10|log1p|pow|hypot|cbrt|random)\b|\*\*/;

// Returns the line number and text of each line that uses math whose result can differ between browsers.
function findUnsafeMath(source) {
  const problems = [];
  source.split('\n').forEach((text, index) => {
    if (UNSAFE_MATH.test(text.split('//')[0])) problems.push({ line: index + 1, text: text.trim() });
  });
  return problems;
}

function updateCodeFiles() {
  const files = [
    'src/scenes/versus-scene.js',
    'src/scenes/survival-scene.js',
    'src/scenes/survival-difficulty.js',
    'src/scenes/pausable-match-scene.js',
  ];
  for (const directory of ['src/engine', 'src/entities', 'src/cards']) {
    for (const fileName of readdirSync(directory)) files.push(`${directory}/${fileName}`);
  }
  return files;
}

test('the unsafe math check finds calls whose results can differ between browsers', () => {
  assert.deepEqual(findUnsafeMath('const a = 1;\nconst b = Math.hypot(a, 2);\nconst c = a ** 2;'), [
    { line: 2, text: 'const b = Math.hypot(a, 2);' },
    { line: 3, text: 'const c = a ** 2;' },
  ]);
  assert.deepEqual(findUnsafeMath('const a = Math.sqrt(2) + Math.floor(1.5); // Math.sin is fine here'), []);
});

test('update code never calls math that can differ between browsers', () => {
  for (const file of updateCodeFiles()) {
    const problems = findUnsafeMath(readFileSync(file, 'utf8'));
    assert.deepEqual(problems, [], `${file}:${problems[0]?.line} ${problems[0]?.text}`);
  }
});
