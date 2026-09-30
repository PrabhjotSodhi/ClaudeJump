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
