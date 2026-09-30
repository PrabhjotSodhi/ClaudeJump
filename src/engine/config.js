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

// The shove. A press winds up for at least SHOVE_WINDUP_TICKS, so a tap lands a few ticks after the press. Holding
// the button charges up to SHOVE_MAX_CHARGE_TICKS, and the release fires. Knockback grows from the tap value to
// SHOVE_MAX_KNOCKBACK_MULTIPLIER times it at full charge. Walking is slower while charging.
export const SHOVE_WINDUP_TICKS = 2;
export const SHOVE_MAX_CHARGE_TICKS = 30;
export const SHOVE_MAX_KNOCKBACK_MULTIPLIER = 1.6;
export const SHOVE_CHARGE_WALK_MULTIPLIER = 0.4;

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
