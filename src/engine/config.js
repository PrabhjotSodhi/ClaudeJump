export const SCREEN_WIDTH = 640;
export const SCREEN_HEIGHT = 360;
export const TICK_RATE = 60;
// The round timer grows, turns red and ticks once a second for this long before sudden death.
export const TIMER_URGENT_SECONDS = 5;
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

// The heat prototype, only on with `?heat` in the URL. Each hit a player takes adds one heat step for the rest of the
// round. A hit's knockback is multiplied by 1 plus the heat built up before it times HEAT_KNOCKBACK_STEP, up to
// HEAT_KNOCKBACK_MAX_MULTIPLIER. The player glows with the first color at one step, and the last color when capped.
export const HEAT_KNOCKBACK_STEP = 0.25;
export const HEAT_KNOCKBACK_MAX_MULTIPLIER = 2;
export const HEAT_GLOW_COLORS = ['#feae34', '#f77622', '#e43b44'];

// The knockout that decides a round plays in slow motion: the world only steps every KNOCKOUT_SLOWMO_STEP_INTERVAL
// ticks for KNOCKOUT_SLOWMO_TICKS ticks, then the round ends as usual. The view zooms in by a whole KNOCKOUT_ZOOM
// toward the player who fell. The crop slides to the player over KNOCKOUT_ZOOM_IN_TICKS ticks and slides back to
// the middle over KNOCKOUT_ZOOM_OUT_TICKS ticks after the slow motion, then the view snaps to normal.
export const KNOCKOUT_SLOWMO_TICKS = 60;
export const KNOCKOUT_SLOWMO_STEP_INTERVAL = 2;
export const KNOCKOUT_ZOOM = 2;
export const KNOCKOUT_ZOOM_IN_TICKS = 12;
export const KNOCKOUT_ZOOM_OUT_TICKS = 20;

// A round opens with 3, 2, 1 counted in the ready phase, where nobody can move, then GO! shows while the fight has
// already started. The whole intro must stay under two seconds.
export const ROUND_COUNTDOWN_BEATS = 3;
export const ROUND_COUNTDOWN_BEAT_TICKS = 28;
export const ROUND_COUNTDOWN_TICKS = ROUND_COUNTDOWN_BEATS * ROUND_COUNTDOWN_BEAT_TICKS;
export const ROUND_GO_TICKS = 30;

// A knockout callout names what happened. A rocket or banana counts as the cause if it hit the player within
// CALLOUT_CAUSE_TICKS of the fall, and a knockout with fewer than CLUTCH_SECONDS left on the round timer is a clutch.
// A callout stays on screen for CALLOUT_TICKS.
export const CALLOUT_CAUSE_TICKS = 90;
export const CALLOUT_TICKS = 60;

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

// Results screen. Awards pop in one at a time: the first after AWARD_FIRST_DELAY_TICKS, then one every
// AWARD_INTERVAL_TICKS. A new award bounces for AWARD_POP_TICKS.
export const AWARD_FIRST_DELAY_TICKS = 45;
export const AWARD_INTERVAL_TICKS = 40;
export const AWARD_POP_TICKS = 8;
// A round won with this many seconds or fewer left on the sudden death countdown earns Clutch survivor.
export const CLUTCH_SECONDS = 3;

// Round modifiers. Before every MODIFIER_EVERY_N_ROUNDS-th round the player with the fewest wins (ties go to the
// first seat) picks one of two modifiers drawn by the seeded random, and it lasts that round. The pick is made
// with left, right and jump, and the highlighted one is taken after MODIFIER_PICK_TICKS. To add a modifier, add an
// entry here and an icon in modifier-icons.js. Each entry may set:
// gravityMultiplier: scales player gravity.
// groundAccelerationMultiplier: scales how fast players speed up and slow down on the ground.
// bananaRainIntervalTicks: a banana drops on a random open platform this often, after a
// BANANA_RAIN_WARNING_TICKS warning marker.
// crateDelayMultiplier: scales the wait for the next crate.
export const MODIFIER_EVERY_N_ROUNDS = 3;
export const MODIFIER_PICK_TICKS = 600;
export const BANANA_RAIN_WARNING_TICKS = 60;
export const ROUND_MODIFIERS = {
  lowGravity: { name: 'Low gravity', gravityMultiplier: 0.6 },
  slipperyFloors: { name: 'Slippery floors', groundAccelerationMultiplier: 0.2 },
  bananaRain: { name: 'Banana rain', bananaRainIntervalTicks: 150 },
  fastCrates: { name: 'Fast crates', crateDelayMultiplier: 0.25 },
};

// Harbor's crane hook. Its first swing starts CRANE_FIRST_SWING_TICKS into the fight, and a swing follows every
// CRANE_WARNING_TICKS + CRANE_SWING_TICKS + CRANE_REST_TICKS. The hook shakes and its path flashes for
// CRANE_WARNING_TICKS before it moves, and swings alternate direction. The path runs from CRANE_PATH_START_X to
// CRANE_PATH_END_X and dips by CRANE_PATH_DIP to CRANE_PATH_BOTTOM_Y at the middle. A player the hook touches is
// knocked away in the swing direction, once per swing.
export const CRANE_FIRST_SWING_TICKS = 600;
export const CRANE_WARNING_TICKS = 60;
export const CRANE_SWING_TICKS = 120;
export const CRANE_REST_TICKS = 120;
export const CRANE_PATH_START_X = 32;
export const CRANE_PATH_END_X = 608;
export const CRANE_PATH_BOTTOM_Y = 240;
export const CRANE_PATH_DIP = 90;
export const CRANE_HOOK_WIDTH = 14;
export const CRANE_HOOK_HEIGHT = 18;
export const CRANE_KNOCKBACK_VELOCITY_X = 9;
export const CRANE_KNOCKBACK_VELOCITY_Y = -5;

// Cooling Towers' steam vents. Each vent sits on a tower top and cycles through STEAM_VENT_REST_TICKS of quiet,
// STEAM_VENT_WARNING_TICKS of hissing and puffing, and STEAM_VENT_BLAST_TICKS of blast. A player in the blast column,
// STEAM_VENT_WIDTH wide and STEAM_VENT_BLAST_HEIGHT tall above the vent, is launched up at STEAM_VENT_LAUNCH_VELOCITY
// once per blast. A vent's `offsetTicks` in the level file moves it along its cycle so vents do not fire together.
export const STEAM_VENT_REST_TICKS = 150;
export const STEAM_VENT_WARNING_TICKS = 60;
export const STEAM_VENT_BLAST_TICKS = 30;
export const STEAM_VENT_WIDTH = 24;
export const STEAM_VENT_BLAST_HEIGHT = 96;
export const STEAM_VENT_LAUNCH_VELOCITY = -13;
