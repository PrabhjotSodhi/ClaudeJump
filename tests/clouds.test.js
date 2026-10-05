import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCREEN_WIDTH } from '../src/engine/config.js';
import { drawClouds } from '../src/vfx/clouds.js';

function recordClouds(backgroundName, tick) {
  const rectangles = [];
  const context = {
    fillStyle: '',
    fillRect(x, y, width, height) {
      rectangles.push({ color: this.fillStyle, x, y, width, height });
    },
  };
  drawClouds(context, backgroundName, tick);
  return rectangles;
}

test('the same tick draws the same clouds', () => {
  assert.deepEqual(recordClouds('harbor', 500), recordClouds('harbor', 500));
});

test('clouds drift between ticks and stay in the sky band', () => {
  const before = recordClouds('harbor', 0);
  const after = recordClouds('harbor', 600);
  assert.notDeepEqual(before, after);
  for (const rectangle of [...before, ...after]) {
    assert.ok(rectangle.y >= 0 && rectangle.y + rectangle.height <= 200);
    assert.ok(Number.isInteger(rectangle.x) && Number.isInteger(rectangle.y));
  }
});

test('clouds wrap across the screen edge and keep drawing forever', () => {
  const seenLeftEdge = [];
  for (let tick = 0; tick < 20000; tick += 50) {
    const rectangles = recordClouds('harbor', tick);
    assert.ok(rectangles.length > 0);
    for (const rectangle of rectangles) assert.ok(rectangle.x < SCREEN_WIDTH + 56);
    seenLeftEdge.push(Math.min(...rectangles.map((rectangle) => rectangle.x)));
  }
  assert.ok(
    seenLeftEdge.some((x) => x < 0),
    'a cloud enters from past the left edge',
  );
  assert.deepEqual(recordClouds('harbor', 0), recordClouds('harbor', 0));
});

test('outdoor arenas draw clouds and indoor arenas draw none', () => {
  for (const name of ['harbor', 'rooftops', 'pier', 'lighthouse', 'shipyard', 'bridge', 'quarry']) {
    assert.ok(recordClouds(name, 10).length > 0, name);
  }
  for (const name of ['cave', 'cooling-towers', 'server-farm']) {
    assert.equal(recordClouds(name, 10).length, 0, name);
  }
});
