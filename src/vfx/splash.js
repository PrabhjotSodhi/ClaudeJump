import { SPLASH_MEDIUM_FALL_SPEED, SPLASH_TIERS } from '../engine/config.js';

// A water spout and rings where a player hits the sea. Display only: it listens to the fall event,
// steps once per tick and is never read by game logic. The droplets come from particles.js.
const PLAYER_HALF_WIDTH = 12;
const SPOUT_RISE_SHARE = 0.35;
const SPOUT_TAPER = 0.45;
const RING_DELAY_TICKS = 6;
const RING_MAX_HALF_HEIGHT = 5;
const SPOUT_BODY_COLOR = '#0099db';
const SPOUT_LIGHT_COLOR = '#2ce8f5';
const SPOUT_SHADE_COLOR = '#124e89';
const FOAM_COLOR = '#ffffff';
const RING_COLOR = '#c0cbdc';

// The last knockout of a round is always large. Any other fall is small or medium by how fast it was.
export function splashTierFor(fallSpeed, lastKnockout = false) {
  if (lastKnockout) return 'large';
  return fallSpeed >= SPLASH_MEDIUM_FALL_SPEED ? 'medium' : 'small';
}

// Shoots up fast, then sinks back slower.
function spoutHeightAt(peakHeight, progress) {
  if (progress < SPOUT_RISE_SHARE) return peakHeight * (1 - (1 - progress / SPOUT_RISE_SHARE) ** 2);
  return peakHeight * (1 - ((progress - SPOUT_RISE_SHARE) / (1 - SPOUT_RISE_SHARE)) ** 2);
}

export class Splashes {
  constructor() {
    this.list = [];
  }

  attach(events, { getPlayers, getWaterLineY }) {
    events.on('player-fell-in-water', ({ playerId, splashTier = 'small' }) => {
      const player = getPlayers().find((candidate) => candidate.id === playerId);
      if (!player) return;
      this.list.push({
        x: Math.round(player.x + PLAYER_HALF_WIDTH),
        waterLineY: getWaterLineY(),
        tier: splashTier,
        age: 0,
      });
    });
  }

  update() {
    for (const splash of this.list) splash.age++;
    this.list = this.list.filter((splash) => splash.age < SPLASH_TIERS[splash.tier].ticks);
  }
}

function drawSpout(context, splash, tier, progress) {
  const height = Math.round(spoutHeightAt(tier.spoutHeight, progress));
  const baseWidth = tier.spoutWidth * (1 - 0.3 * progress);
  for (let row = 0; row < height; row++) {
    const width = Math.max(2, Math.round(baseWidth * (1 - SPOUT_TAPER * (row / tier.spoutHeight))));
    const left = splash.x - Math.floor(width / 2);
    const y = splash.waterLineY - 1 - row;
    context.fillStyle = row >= height - 2 ? FOAM_COLOR : SPOUT_BODY_COLOR;
    context.fillRect(left, y, width, 1);
    if (row < height - 2) {
      context.fillStyle = SPOUT_LIGHT_COLOR;
      context.fillRect(left, y, Math.min(2, width - 1), 1);
      context.fillStyle = SPOUT_SHADE_COLOR;
      context.fillRect(left + width - 1, y, 1, 1);
    }
  }
}

function drawRings(context, splash, tier) {
  context.fillStyle = RING_COLOR;
  for (let ring = 0; ring < tier.ringCount; ring++) {
    const ringAge = splash.age - ring * RING_DELAY_TICKS;
    if (ringAge <= 0) continue;
    const radiusX = Math.round(ringAge * tier.ringSpeed * 2);
    const radiusY = Math.min(RING_MAX_HALF_HEIGHT, Math.max(1, Math.round(radiusX / 8)));
    context.globalAlpha = Math.max(0, 1 - splash.age / tier.ticks);
    for (let offsetX = -radiusX; offsetX <= radiusX; offsetX++) {
      const offsetY = Math.round(radiusY * Math.sqrt(1 - (offsetX / radiusX) ** 2));
      context.fillRect(splash.x + offsetX, splash.waterLineY + offsetY, 1, 1);
      context.fillRect(splash.x + offsetX, splash.waterLineY - offsetY, 1, 1);
    }
  }
  context.globalAlpha = 1;
}

export function drawSplashes(context, scene) {
  for (const splash of scene.splashes.list) {
    const tier = SPLASH_TIERS[splash.tier];
    drawRings(context, splash, tier);
    drawSpout(context, splash, tier, splash.age / tier.ticks);
  }
}
