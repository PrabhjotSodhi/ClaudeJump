export const SCREEN_WIDTH = 640;
export const SCREEN_HEIGHT = 360;
export const TICK_RATE = 60;
export const TILE_SIZE = 16;
export const LEVEL_COLUMNS = 40;
export const LEVEL_ROWS = 23;
export const SEA_COLUMN_COUNT = 80;
export const SEA_COLUMN_WIDTH = SCREEN_WIDTH / SEA_COLUMN_COUNT;

// How many ticks a hit freezes the hitter, the player hit and the projectile, by how hard the hit is.
export const HITSTOP_TICKS = { light: 3, medium: 4, heavy: 6 };

// How a hit looks, by how hard it is: how far and how long the screen kicks, and how many sparks fly.
export const IMPACT_EFFECTS = {
  light: { shakePixels: 2, shakeTicks: 8, sparkCount: 6, sparkSpeed: 3 },
  medium: { shakePixels: 3, shakeTicks: 10, sparkCount: 10, sparkSpeed: 4 },
  heavy: { shakePixels: 4, shakeTicks: 12, sparkCount: 16, sparkSpeed: 5 },
};
// Medium and heavy hits leave a trail behind the player until their knockback drops below this speed.
export const LAUNCH_TRAIL_STRENGTHS = ['medium', 'heavy'];
export const LAUNCH_TRAIL_MIN_SPEED = 2.5;

// Online matches. A press is scheduled this many ticks ahead so it can cross the network before it is needed.
export const INPUT_DELAY_TICKS = 4;
export const HASH_INTERVAL_TICKS = 60;
// Ticks a device waits for missing inputs before it treats the player as gone.
export const STALL_TIMEOUT_TICKS = 600;
// How long the desync or disconnect message shows before the player returns to the title.
export const ONLINE_MESSAGE_TICKS = 240;
// The stall message only shows once the wait is long enough to notice.
export const STALL_MESSAGE_TICKS = 30;
// Hashes still waiting for a slow device are forgotten after this many hash intervals.
export const HASH_KEEP_INTERVALS = 4;
