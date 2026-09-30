import {
  STEAM_VENT_BLAST_HEIGHT,
  STEAM_VENT_BLAST_TICKS,
  STEAM_VENT_LAUNCH_VELOCITY,
  STEAM_VENT_REST_TICKS,
  STEAM_VENT_WARNING_TICKS,
  STEAM_VENT_WIDTH,
} from '../engine/config.js';
import { Entity } from '../engine/entity.js';
import { steamBillow } from '../vfx/steam-billow.js';

const CYCLE_TICKS = STEAM_VENT_REST_TICKS + STEAM_VENT_WARNING_TICKS + STEAM_VENT_BLAST_TICKS;
const GRATE_HEIGHT = 5;
const GRATE_LIGHT_COLOR = '#8b9bb4';
const GRATE_COLOR = '#3a4466';
const GRATE_SHADE_COLOR = '#262b44';
const SLOT_COLOR = '#181425';
// While a vent warns, its slots glow and flash between these.
const SLOT_WARNING_COLORS = ['#e43b44', '#f77622'];
const SLOT_SPACING = 3;
const GRATE_FLASH_TICKS = 6;
const OUTLINE_COLOR = '#181425';
const STEAM_COLORS = ['#ffffff', '#c0cbdc', '#8b9bb4'];
const PUFF_COUNT = 3;
const PUFF_SIZE = 5;
const PUFF_RISE_TICKS = 24;
const PUFF_RISE_PIXELS = 20;
// The blast is drawn in bands this tall. Each band's width wobbles so the column billows, with a white core inside a
// grey edge. Its top bands thin out into a checker so the column fades instead of ending in a flat line.
const BLAST_BAND_HEIGHT = 3;
const BLAST_WOBBLE_PIXELS = 2;
const BLAST_CORE_INSET = 3;
const BLAST_FADE_BANDS = 5;

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

  // Emits 'steam-vent-hissed' as a warning begins.
  update({ players, events }) {
    this.ticks++;
    const wasWarning = this.phase === 'warning';
    const ticksIntoCycle = (this.ticks + this.offsetTicks) % CYCLE_TICKS;
    if (ticksIntoCycle < STEAM_VENT_REST_TICKS) {
      this.phase = 'idle';
      this.launchedPlayerIds.clear();
    } else if (ticksIntoCycle < STEAM_VENT_REST_TICKS + STEAM_VENT_WARNING_TICKS) {
      this.phase = 'warning';
    } else {
      this.phase = 'blasting';
    }
    if (this.phase === 'warning' && !wasWarning) events?.emit('steam-vent-hissed', { x: this.x + this.width / 2 });
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
    const slotColor =
      this.phase === 'warning'
        ? SLOT_WARNING_COLORS[flashing ? 0 : 1]
        : this.phase === 'blasting'
          ? STEAM_COLORS[0]
          : SLOT_COLOR;
    if (this.phase === 'blasting') this.renderBlast(context, grateY);
    this.renderGrate(context, grateY, slotColor);
    if (this.phase === 'warning') this.renderPuffs(context, grateY);
  }

  // A steel grate lit along its top edge, with dark slots the steam comes through.
  renderGrate(context, grateY, slotColor) {
    context.fillStyle = OUTLINE_COLOR;
    context.fillRect(this.x - 1, grateY - 1, this.width + 2, GRATE_HEIGHT + 1);
    context.fillStyle = GRATE_COLOR;
    context.fillRect(this.x, grateY, this.width, GRATE_HEIGHT);
    context.fillStyle = GRATE_LIGHT_COLOR;
    context.fillRect(this.x, grateY, this.width, 1);
    context.fillStyle = GRATE_SHADE_COLOR;
    context.fillRect(this.x, grateY + GRATE_HEIGHT - 1, this.width, 1);
    context.fillStyle = slotColor;
    for (let slotX = this.x + 2; slotX < this.x + this.width - 1; slotX += SLOT_SPACING) {
      context.fillRect(slotX, grateY + 1, 1, GRATE_HEIGHT - 2);
    }
  }

  // Small round puffs rise off the grate and grey as they go.
  renderPuffs(context, grateY) {
    for (let puff = 0; puff < PUFF_COUNT; puff++) {
      const age = (this.ticks + puff * (PUFF_RISE_TICKS / PUFF_COUNT)) % PUFF_RISE_TICKS;
      const rise = Math.floor((age / PUFF_RISE_TICKS) * PUFF_RISE_PIXELS);
      context.fillStyle = STEAM_COLORS[Math.min(STEAM_COLORS.length - 1, Math.floor(age / 8))];
      const puffX = Math.round(this.x + 1 + puff * ((this.width - PUFF_SIZE - 2) / (PUFF_COUNT - 1)));
      const puffY = grateY - PUFF_SIZE - rise;
      context.fillRect(puffX + 1, puffY, PUFF_SIZE - 2, PUFF_SIZE);
      context.fillRect(puffX, puffY + 1, PUFF_SIZE, PUFF_SIZE - 2);
    }
  }

  renderBlast(context, grateY) {
    const bandCount = Math.floor((grateY - this.y) / BLAST_BAND_HEIGHT);
    const centerX = this.x + this.width / 2;
    for (let band = 0; band < bandCount; band++) {
      const bandY = grateY - (band + 1) * BLAST_BAND_HEIGHT;
      const wobble = steamBillow(band, this.ticks, BLAST_WOBBLE_PIXELS);
      const halfWidth = this.width / 2 - BLAST_WOBBLE_PIXELS + wobble;
      const fading = band >= bandCount - BLAST_FADE_BANDS;
      for (let x = Math.round(centerX - halfWidth); x < Math.round(centerX + halfWidth); x++) {
        for (let y = bandY; y < bandY + BLAST_BAND_HEIGHT; y++) {
          if (fading && (x + y + band) % 2 === 0) continue;
          const inCore = !fading && Math.abs(x + 0.5 - centerX) < halfWidth - BLAST_CORE_INSET;
          context.fillStyle = fading ? STEAM_COLORS[2] : inCore ? STEAM_COLORS[0] : STEAM_COLORS[1];
          context.fillRect(x, y, 1, 1);
        }
      }
    }
  }
}
