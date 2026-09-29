import assert from 'node:assert/strict';
import { test } from 'node:test';
import { difficultyAt } from '../src/scenes/survival-difficulty.js';

test('rockets come faster the higher the player climbs', () => {
  assert.ok(difficultyAt(5000).rocketIntervalTicks < difficultyAt(0).rocketIntervalTicks);
});

test('every value stays between its first and last steps', () => {
  const first = difficultyAt(0);
  const last = difficultyAt(8000);
  for (const height of [-100, 0, 1, 1500, 3000, 5000, 7999, 8000, 20000]) {
    const difficulty = difficultyAt(height);
    assert.ok(difficulty.rocketIntervalTicks <= first.rocketIntervalTicks);
    assert.ok(difficulty.rocketIntervalTicks >= last.rocketIntervalTicks);
    assert.ok(difficulty.crabChance >= first.crabChance && difficulty.crabChance <= last.crabChance);
    assert.ok(
      difficulty.specialPlatformChance >= first.specialPlatformChance &&
        difficulty.specialPlatformChance <= last.specialPlatformChance,
    );
  }
});

test('the steps hit their table values and stay flat past the last one', () => {
  assert.deepEqual(difficultyAt(0), { rocketIntervalTicks: 420, crabChance: 0.05, specialPlatformChance: 0.1 });
  assert.deepEqual(difficultyAt(3000), { rocketIntervalTicks: 240, crabChance: 0.15, specialPlatformChance: 0.3 });
  assert.deepEqual(difficultyAt(50000), difficultyAt(8000));
});
