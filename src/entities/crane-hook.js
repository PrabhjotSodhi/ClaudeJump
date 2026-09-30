import {
  CRANE_FIRST_SWING_TICKS,
  CRANE_HOOK_HEIGHT,
  CRANE_HOOK_WIDTH,
  CRANE_KNOCKBACK_VELOCITY_X,
  CRANE_KNOCKBACK_VELOCITY_Y,
  CRANE_PATH_BOTTOM_Y,
  CRANE_PATH_DIP,
  CRANE_PATH_END_X,
  CRANE_PATH_START_X,
  CRANE_REST_TICKS,
  CRANE_SWING_TICKS,
  CRANE_WARNING_TICKS,
  SCREEN_WIDTH,
} from '../engine/config.js';
import { Entity } from '../engine/entity.js';

const CYCLE_TICKS = CRANE_WARNING_TICKS + CRANE_SWING_TICKS + CRANE_REST_TICKS;
const FIRST_WARNING_TICKS = CRANE_FIRST_SWING_TICKS - CRANE_WARNING_TICKS;
const PATH_MARKER_COUNT = 24;
const MARKER_PULSE_TICKS = 8;
const MARKER_COLORS = ['#fee761', '#e43b44'];
const MARKER_SIZE = 4;
const SHAKE_PIXELS = 2;
const CABLE_COLOR = '#262b44';
const CABLE_LIGHT_COLOR = '#5a6988';
const TROLLEY_X = SCREEN_WIDTH / 2;

// The center of the hook part of the way through a swing. `progress` runs from 0 to 1, and `direction` is 1 for a swing from
// the start of the path to its end and -1 for the way back. Only arithmetic, so every browser computes the same spot.
export function cranePathPoint(progress, direction) {
  const eased = progress * progress * (3 - 2 * progress);
  const along = direction > 0 ? eased : 1 - eased;
  const offsetFromMiddle = 2 * along - 1;
  return {
    x: CRANE_PATH_START_X + (CRANE_PATH_END_X - CRANE_PATH_START_X) * along,
    y: CRANE_PATH_BOTTOM_Y - CRANE_PATH_DIP * offsetFromMiddle * offsetFromMiddle,
  };
}

// The hook of Harbor's crane, driven only by how many ticks of the fight have passed. `phase` is 'idle' (parked, harmless),
// 'warning' (parked and shaking, its path flashing) or 'swinging' (dangerous). The scene calls update(scene) once per
// fight tick. While swinging, every player who overlaps the hook is knocked away in `direction`, once per swing.
// `hitPlayerIds` holds the players already hit this swing.
export class CraneHook extends Entity {
  constructor() {
    super({ x: 0, y: 0, width: CRANE_HOOK_WIDTH, height: CRANE_HOOK_HEIGHT });
    this.ticks = 0;
    this.phase = 'idle';
    this.swingIndex = 0;
    this.direction = 1;
    this.progress = 0;
    this.hitPlayerIds = new Set();
    this.moveTo(cranePathPoint(0, 1));
  }

  moveTo(center) {
    this.x = center.x - this.width / 2;
    this.y = center.y - this.height / 2;
  }

  update({ players, events }) {
    this.updateSwing();
    if (this.phase !== 'swinging') return;

    for (const player of players) {
      if (player.inWater || this.hitPlayerIds.has(player.id) || !player.overlaps(this)) continue;

      this.hitPlayerIds.add(player.id);
      player.freeze('heavy', CRANE_KNOCKBACK_VELOCITY_X * this.direction, CRANE_KNOCKBACK_VELOCITY_Y);
      events.emit('trap-sprung', {
        ownerId: null,
        targetId: player.id,
        directionX: this.direction,
        directionY: 0,
        strength: 'heavy',
      });
    }
  }

  updateSwing() {
    this.ticks++;
    const ticksIntoCycles = this.ticks - FIRST_WARNING_TICKS;
    if (ticksIntoCycles < 0) return;

    const swingIndex = Math.floor(ticksIntoCycles / CYCLE_TICKS);
    const ticksIntoCycle = ticksIntoCycles % CYCLE_TICKS;
    if (swingIndex !== this.swingIndex) this.hitPlayerIds.clear();
    this.swingIndex = swingIndex;
    this.direction = swingIndex % 2 === 0 ? 1 : -1;
    const ticksSwinging = ticksIntoCycle - CRANE_WARNING_TICKS;
    if (ticksSwinging < 0) {
      this.phase = 'warning';
      this.progress = 0;
    } else if (ticksSwinging < CRANE_SWING_TICKS) {
      this.phase = 'swinging';
      this.progress = (ticksSwinging + 1) / CRANE_SWING_TICKS;
    } else {
      this.phase = 'idle';
      this.progress = 1;
    }
    this.moveTo(cranePathPoint(this.progress, this.direction));
  }

  // appearance is { sprites }: the hook is the crane-hook frame of the props sprite file, a hazard striped block over a
  // hook that fills the hitbox.
  render(context, { sprites } = {}) {
    const shake = this.phase === 'warning' && this.ticks % 2 === 0 ? SHAKE_PIXELS : 0;
    const centerX = Math.round(this.x + this.width / 2) + shake;
    const topY = Math.round(this.y);
    if (this.phase === 'warning') this.renderPath(context);
    this.renderCable(context, centerX, topY);
    const sprite = sprites?.props?.['crane-hook'];
    if (sprite) context.drawImage(sprite, centerX - this.width / 2, topY);
  }

  // A solid steel line from the trolley at the top of the screen to the hook's block, lit along one side.
  renderCable(context, hookX, hookY) {
    const cableLength = Math.max(Math.abs(hookX - TROLLEY_X), hookY);
    for (let step = 0; step <= cableLength; step++) {
      const fraction = step / cableLength;
      const x = Math.round(TROLLEY_X + (hookX - TROLLEY_X) * fraction);
      const y = Math.round(hookY * fraction);
      context.fillStyle = CABLE_COLOR;
      context.fillRect(x - 1, y, 1, 1);
      context.fillStyle = CABLE_LIGHT_COLOR;
      context.fillRect(x, y, 1, 1);
    }
  }

  renderPath(context) {
    const flash = Math.floor(this.ticks / MARKER_PULSE_TICKS) % 2;
    context.fillStyle = MARKER_COLORS[flash];
    for (let marker = 0; marker <= PATH_MARKER_COUNT; marker++) {
      const point = cranePathPoint(marker / PATH_MARKER_COUNT, this.direction);
      context.fillRect(
        Math.round(point.x - MARKER_SIZE / 2),
        Math.round(point.y - MARKER_SIZE / 2),
        MARKER_SIZE,
        MARKER_SIZE,
      );
    }
  }
}
