// Fixed-tick accumulator, decoupled from the display refresh rate. Catch-up
// is capped so a tab coming back from the background does not spiral.
const MAX_CATCH_UP_MILLISECONDS = 250;

export function createGameLoop({ tickRate, update, render }) {
  const tickDurationMilliseconds = 1000 / tickRate;
  let accumulatedMilliseconds = 0;
  let lastTimestamp = null;
  let animationFrameId = null;

  function frame(timestamp) {
    if (lastTimestamp === null) lastTimestamp = timestamp;
    accumulatedMilliseconds += Math.min(timestamp - lastTimestamp, MAX_CATCH_UP_MILLISECONDS);
    lastTimestamp = timestamp;

    while (accumulatedMilliseconds >= tickDurationMilliseconds) {
      update();
      accumulatedMilliseconds -= tickDurationMilliseconds;
    }

    render(timestamp);
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
