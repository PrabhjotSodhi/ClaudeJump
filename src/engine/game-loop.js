// Fixed-tick accumulator, decoupled from the display refresh rate. Catch-up
// is capped so a tab coming back from the background does not spiral.
const MAX_CATCH_UP_MILLISECONDS = 250;

export function createGameLoop({ tickRate, update, render }) {
  const tickDurationMilliseconds = 1000 / tickRate;
  let accumulatedMilliseconds = 0;
  let lastTimestamp = null;
  let animationFrameId = null;
  let renderErrorReported = false;

  function frame(timestamp) {
    if (lastTimestamp === null) lastTimestamp = timestamp;
    accumulatedMilliseconds += Math.min(timestamp - lastTimestamp, MAX_CATCH_UP_MILLISECONDS);
    lastTimestamp = timestamp;

    while (accumulatedMilliseconds >= tickDurationMilliseconds) {
      update();
      accumulatedMilliseconds -= tickDurationMilliseconds;
    }

    // A drawing bug must never stop the game, so the error is reported once and the next frame runs as usual.
    try {
      render(timestamp);
    } catch (error) {
      if (!renderErrorReported) console.error(error);
      renderErrorReported = true;
    }
    animationFrameId = requestAnimationFrame(frame);
  }

  return {
    start() {
      animationFrameId = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(animationFrameId);
    },
  };
}
