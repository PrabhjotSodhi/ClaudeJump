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
// A fully charged shove throws this many more sparks, and faster ones, than a tap.
export const CHARGED_SHOVE_EXTRA_SPARKS = 6;
export const CHARGED_SHOVE_EXTRA_SPARK_SPEED = 2;
// Medium and heavy hits leave a trail behind the player until their knockback drops below this speed.
export const LAUNCH_TRAIL_STRENGTHS = ['medium', 'heavy'];
export const LAUNCH_TRAIL_MIN_SPEED = 2.5;

// How big the splash is when a player hits the sea. A fall at or above SPLASH_MEDIUM_FALL_SPEED makes a medium
// splash, and the last knockout of a round always makes a large one. Height is the spout peak in pixels, ticks how
// long the splash lasts, ringCount and ringSpeed the rings spreading over the water, dropletCount and dropletSpeed
// the spray.
export const SPLASH_MEDIUM_FALL_SPEED = 8;
export const SPLASH_TIERS = {
  small: { spoutHeight: 22, spoutWidth: 14, ticks: 32, ringCount: 1, ringSpeed: 1.2, dropletCount: 8, dropletSpeed: 3 },
  medium: {
    spoutHeight: 38,
    spoutWidth: 28,
    ticks: 42,
    ringCount: 2,
    ringSpeed: 1.6,
    dropletCount: 14,
    dropletSpeed: 4,
  },
  large: {
    spoutHeight: 64,
    spoutWidth: 28,
    ticks: 56,
    ringCount: 3,
    ringSpeed: 2.2,
    dropletCount: 24,
    dropletSpeed: 5.5,
  },
};

// The shove. A press winds up for at least SHOVE_WINDUP_TICKS, so a tap lands a few ticks after the press. Holding
// the button charges up to SHOVE_MAX_CHARGE_TICKS, and the release fires. Knockback grows from the tap value to
// SHOVE_MAX_KNOCKBACK_MULTIPLIER times it at full charge. Walking is slower while charging.
export const SHOVE_WINDUP_TICKS = 2;
export const SHOVE_MAX_CHARGE_TICKS = 30;
export const SHOVE_MAX_KNOCKBACK_MULTIPLIER = 1.6;
export const SHOVE_CHARGE_WALK_MULTIPLIER = 0.4;
// While a shove charges, the scene reports its progress this often, so the charge sound can rise with it.
export const SHOVE_CHARGE_REPORT_INTERVAL_TICKS = 4;

// Two shoves that meet cancel out and bounce both players apart. A shove takes part in a clash while it is winding up
// or in its first SHOVE_CLASH_WINDOW_TICKS ticks, so presses a couple of ticks apart still clash. If one shover's charge beats the other's by at
// least SHOVE_CLASH_CHARGE_MARGIN (charge runs from 0 to 1), that shove still lands with its knockback scaled by
// SHOVE_CLASH_WIN_KNOCKBACK_MULTIPLIER, and the other shove is cancelled.
export const SHOVE_CLASH_WINDOW_TICKS = 3;
export const SHOVE_CLASH_BOUNCE_VELOCITY_X = 3;
export const SHOVE_CLASH_CHARGE_MARGIN = 0.2;
export const SHOVE_CLASH_WIN_KNOCKBACK_MULTIPLIER = 0.5;

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
