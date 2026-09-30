const SWAY_MAX_PIXELS = 6;
const SWAY_PERIOD_TICKS = 70;
// The sway shrinks with the distance left to fall, so it is gone by the time the crate lands.
const SWAY_SETTLE_DISTANCE = 120;

// Sideways offset in pixels for a crate that has fallen for `fallenTicks` ticks and has
// `distanceToGround` pixels left. A pure function of its inputs, used only for drawing.
export function swayOffset(fallenTicks, distanceToGround) {
  const amplitude = SWAY_MAX_PIXELS * Math.min(1, Math.max(0, distanceToGround) / SWAY_SETTLE_DISTANCE);
  return Math.round(Math.sin((fallenTicks * 2 * Math.PI) / SWAY_PERIOD_TICKS) * amplitude) + 0;
}

const FLUTTER_WOBBLE_PIXELS = 3;
const FLUTTER_PERIOD_TICKS = 12;

// Sideways wobble in pixels of a popped canopy `poppedTicks` ticks after the pop. Used only for drawing.
export function flutterWobble(poppedTicks) {
  return Math.round(Math.sin((poppedTicks * 2 * Math.PI) / FLUTTER_PERIOD_TICKS) * FLUTTER_WOBBLE_PIXELS);
}

const CORD_FLUTTER_PERIOD_TICKS = 10;

// Sideways ripple in pixels, -1 to 1, of one step down a parachute cord. The ripple runs down the cord over time.
export function cordFlutter(fallenTicks, step) {
  return Math.round(Math.sin(((fallenTicks - step * 2) * 2 * Math.PI) / CORD_FLUTTER_PERIOD_TICKS) * 0.6);
}
