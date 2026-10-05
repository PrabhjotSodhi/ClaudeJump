import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameLoop } from '../src/engine/game-loop.js';

// Runs the loop on hand-driven animation frames, 1/60 of a second apart.
function runFrames({ frameCount, render }) {
  const pendingFrames = [];
  const previousRequest = globalThis.requestAnimationFrame;
  const previousConsoleError = console.error;
  const reportedErrors = [];
  globalThis.requestAnimationFrame = (callback) => pendingFrames.push(callback);
  console.error = (error) => reportedErrors.push(error);
  let updateCount = 0;
  try {
    createGameLoop({ tickRate: 60, update: () => updateCount++, render }).start();
    for (let frame = 0; frame < frameCount && pendingFrames.length > 0; frame++) {
      pendingFrames.shift()((frame * 1000) / 60);
    }
  } finally {
    globalThis.requestAnimationFrame = previousRequest;
    console.error = previousConsoleError;
  }
  return { updateCount, reportedErrors };
}

test('a render that throws does not stop the game, and the error is reported once', () => {
  let renderCount = 0;
  const { updateCount, reportedErrors } = runFrames({
    frameCount: 10,
    render: () => {
      renderCount++;
      throw new Error('drawing failed');
    },
  });

  assert.equal(renderCount, 10, 'every frame still renders');
  assert.ok(updateCount >= 8, 'ticks keep running');
  assert.equal(reportedErrors.length, 1);
  assert.equal(reportedErrors[0].message, 'drawing failed');
});
