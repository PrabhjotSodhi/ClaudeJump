// A fireball and a cloud of smoke where Pass the bomb's fuse ran out, so the blown up player goes out in a burst
// instead of just vanishing. Display only: it reacts to the blow up event and works out every frame from the age in
// ticks, so it never changes game state.
import { flashStrength } from '../engine/sound-settings.js';

const FLASH_TICKS = 3;
const FLASH_RADIUS = 18;
const FLASH_COLOR = '#ffffff';
// The fireball grows from its first radius to its last while its colors cool, one step per stage.
const FIRE_TICKS = 12;
const FIRE_START_RADIUS = 10;
const FIRE_END_RADIUS = 16;
const FIRE_CORE_INSET = 5;
const FIRE_STAGES = [
  { outer: '#feae34', core: '#fee761' },
  { outer: '#f77622', core: '#feae34' },
  { outer: '#be4a2f', core: '#f77622' },
];
// Smoke puffs hang where the fireball was, rise and shrink away.
const CLOUD_TICKS = 48;
const SMOKE_PUFFS = [
  { x: 0, y: -6, radius: 9 },
  { x: -10, y: 2, radius: 7 },
  { x: 10, y: 1, radius: 7 },
  { x: -5, y: 8, radius: 6 },
  { x: 6, y: 9, radius: 5 },
];
const SMOKE_LIGHT_COLOR = '#8b9bb4';
const SMOKE_DARK_COLOR = '#5a6988';
const SMOKE_RISE_TICKS_PER_PIXEL = 3;

export class BlastClouds {
  constructor() {
    this.clouds = [];
  }

  attach(events, getPlayers, getTickCount) {
    events.on('player-blown-up', ({ playerId }) => {
      const player = getPlayers().find((candidate) => candidate.id === playerId);
      if (!player) return;
      this.clouds.push({
        x: Math.round(player.x + player.width / 2),
        y: Math.round(player.y + player.height / 2),
        spawnTick: getTickCount(),
      });
    });
  }

  // Also drops clouds that have finished, so the list never grows unbounded.
  activeClouds(currentTick) {
    this.clouds = this.clouds.filter((cloud) => currentTick - cloud.spawnTick < CLOUD_TICKS);
    return this.clouds;
  }
}

// A filled circle in whole pixel rows.
function fillDisc(context, centerX, centerY, radius) {
  for (let offsetY = -radius; offsetY <= radius; offsetY++) {
    const halfWidth = Math.round(Math.sqrt(radius * radius - offsetY * offsetY));
    context.fillRect(centerX - halfWidth, centerY + offsetY, 2 * halfWidth + 1, 1);
  }
}

function drawSmoke(context, cloud, age) {
  const progress = age / CLOUD_TICKS;
  const rise = Math.floor(age / SMOKE_RISE_TICKS_PER_PIXEL);
  context.fillStyle = progress < 0.5 ? SMOKE_LIGHT_COLOR : SMOKE_DARK_COLOR;
  for (const puff of SMOKE_PUFFS) {
    const radius = Math.round(puff.radius * (1 - progress));
    if (radius > 0) fillDisc(context, cloud.x + puff.x, cloud.y + puff.y - rise, radius);
  }
}

function drawFire(context, cloud, age) {
  const stage = FIRE_STAGES[Math.floor((age / FIRE_TICKS) * FIRE_STAGES.length)];
  const radius = Math.round(FIRE_START_RADIUS + ((FIRE_END_RADIUS - FIRE_START_RADIUS) * age) / FIRE_TICKS);
  context.fillStyle = stage.outer;
  fillDisc(context, cloud.x, cloud.y, radius);
  context.fillStyle = stage.core;
  fillDisc(context, cloud.x, cloud.y, radius - FIRE_CORE_INSET);
}

export function drawBlastClouds(context, scene, glowContext) {
  for (const cloud of scene.blastClouds.activeClouds(scene.tickCount)) {
    const age = scene.tickCount - cloud.spawnTick;
    drawSmoke(context, cloud, age);
    if (age < FIRE_TICKS) {
      drawFire(context, cloud, age);
      if (glowContext) drawFire(glowContext, cloud, age);
    }
    if (age < FLASH_TICKS) {
      context.globalAlpha = flashStrength();
      context.fillStyle = FLASH_COLOR;
      fillDisc(context, cloud.x, cloud.y, FLASH_RADIUS);
      context.globalAlpha = 1;
    }
  }
}
