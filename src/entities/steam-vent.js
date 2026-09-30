import {
  STEAM_VENT_BLAST_HEIGHT,
  STEAM_VENT_BLAST_TICKS,
  STEAM_VENT_LAUNCH_VELOCITY,
  STEAM_VENT_REST_TICKS,
  STEAM_VENT_WARNING_TICKS,
  STEAM_VENT_WIDTH,
} from '../engine/config.js';
import { Entity } from '../engine/entity.js';

const CYCLE_TICKS = STEAM_VENT_REST_TICKS + STEAM_VENT_WARNING_TICKS + STEAM_VENT_BLAST_TICKS;
const GRATE_HEIGHT = 4;
const GRATE_COLOR = '#3a4466';
const GRATE_WARNING_COLOR = '#e43b44';
const GRATE_FLASH_TICKS = 6;
const OUTLINE_COLOR = '#181425';
const STEAM_COLORS = ['#ffffff', '#c0cbdc', '#8b9bb4'];
const PUFF_COUNT = 3;
const PUFF_SIZE = 4;
const PUFF_RISE_TICKS = 24;
const PUFF_RISE_PIXELS = 20;
const BLAST_CELL = 6;
const BLAST_FLICKER_TICKS = 3;

// A steam vent standing with its base at (x, y) on a tower top. `phase` is 'idle', 'warning' (hissing and puffing small
// steam) or 'blasting' (launching). The scene calls update(scene) once per fight tick. The blast column is the entity's
// own box, so `x`, `y`, `width` and `height` are where a player has to stand. `launchedPlayerIds` holds the players
// already launched by this blast.
export class SteamVent extends Entity {
  constructor({ x, y, offsetTicks = 0 }) {
    super({
      x: x - STEAM_VENT_WIDTH / 2,
      y: y - STEAM_VENT_BLAST_HEIGHT,
      width: STEAM_VENT_WIDTH,
      height: STEAM_VENT_BLAST_HEIGHT,
    });
    this.offsetTicks = offsetTicks;
    this.ticks = 0;
    this.phase = 'idle';
    this.launchedPlayerIds = new Set();
  }

  get baseY() {
    return this.y + this.height;
  }

  update({ players }) {
    this.ticks++;
    const ticksIntoCycle = (this.ticks + this.offsetTicks) % CYCLE_TICKS;
    if (ticksIntoCycle < STEAM_VENT_REST_TICKS) {
      this.phase = 'idle';
      this.launchedPlayerIds.clear();
    } else if (ticksIntoCycle < STEAM_VENT_REST_TICKS + STEAM_VENT_WARNING_TICKS) {
      this.phase = 'warning';
    } else {
      this.phase = 'blasting';
    }
    if (this.phase !== 'blasting') return;

    for (const player of players) {
      if (this.launchedPlayerIds.has(player.id) || !player.overlaps(this)) continue;

      this.launchedPlayerIds.add(player.id);
      player.launchUpward(STEAM_VENT_LAUNCH_VELOCITY);
    }
  }

  render(context) {
    const grateY = this.baseY - GRATE_HEIGHT;
    const flashing = this.phase === 'warning' && Math.floor(this.ticks / GRATE_FLASH_TICKS) % 2 === 0;
    context.fillStyle = OUTLINE_COLOR;
    context.fillRect(this.x - 1, grateY - 1, this.width + 2, GRATE_HEIGHT + 1);
    context.fillStyle = flashing ? GRATE_WARNING_COLOR : GRATE_COLOR;
    context.fillRect(this.x, grateY, this.width, GRATE_HEIGHT);
    if (this.phase === 'warning') this.renderPuffs(context, grateY);
    if (this.phase === 'blasting') this.renderBlast(context, grateY);
  }

  renderPuffs(context, grateY) {
    for (let puff = 0; puff < PUFF_COUNT; puff++) {
      const age = (this.ticks + puff * (PUFF_RISE_TICKS / PUFF_COUNT)) % PUFF_RISE_TICKS;
      const rise = Math.floor((age / PUFF_RISE_TICKS) * PUFF_RISE_PIXELS);
      context.fillStyle = STEAM_COLORS[Math.min(STEAM_COLORS.length - 1, Math.floor(age / 8))];
      const puffX = this.x + 2 + puff * ((this.width - PUFF_SIZE - 4) / (PUFF_COUNT - 1));
      context.fillRect(Math.round(puffX), grateY - PUFF_SIZE - rise, PUFF_SIZE, PUFF_SIZE);
    }
  }

  renderBlast(context, grateY) {
    const flicker = Math.floor(this.ticks / BLAST_FLICKER_TICKS);
    for (let row = 0, cellY = grateY - BLAST_CELL; cellY >= this.y; row++, cellY -= BLAST_CELL) {
      for (let column = 0; column < this.width / BLAST_CELL; column++) {
        if ((row + column + flicker) % 2 === 0) continue;
        context.fillStyle = STEAM_COLORS[Math.min(STEAM_COLORS.length - 1, Math.floor(row / 5))];
        context.fillRect(this.x + column * BLAST_CELL, cellY, BLAST_CELL, BLAST_CELL);
      }
    }
  }
}
