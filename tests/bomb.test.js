import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Bomb } from '../src/entities/bomb.js';

for (const facing of [1, -1]) {
  test(`a bomb thrown facing ${facing} only ever travels forward and ignores its thrower`, () => {
    const bomb = new Bomb({ x: 300, y: 200, facing, throwerId: 'red' });
    const thrower = { id: 'red', x: 300, y: 200, width: 24, height: 28, inWater: false };
    let previousX = bomb.x;

    for (let tick = 0; tick < 60 && !bomb.exploded; tick++) {
      bomb.update([thrower], [], 1000);
      assert.ok((bomb.x - previousX) * facing > 0, 'each tick moves the bomb the way it was thrown');
      previousX = bomb.x;
    }

    assert.equal(bomb.exploded, false, 'touching the thrower never sets it off');
  });
}

test('a bomb explodes when its fuse runs out', () => {
  const bomb = new Bomb({ x: 300, y: 200, facing: 1, throwerId: 'red' });
  bomb.velocityY = 0;
  bomb.velocityX = 0;

  for (let tick = 0; tick < 89; tick++) bomb.update([], [], 100000);
  assert.equal(bomb.exploded, false);
  bomb.velocityY = 0;
  bomb.update([], [], 100000);

  assert.equal(bomb.exploded, true);
});
