import { SPLASH_DROPLET_GRAVITY, SPLASH_MEDIUM_FALL_SPEED, SPLASH_TIERS } from '../engine/config.js';
import { createParticle, stepParticle, toPixel } from './particle-rules.js';

// Water thrown up where something hits the sea. Display only: it listens to the fall events, steps once per tick
// and is never read by game logic. Each droplet is a particle on the shared rules that flies on its own arc and is
// gone once it falls back into the sea. Nothing here is random: droplets spread at evenly spaced angles and their
// speeds follow a fixed pattern.
const PLAYER_HALF_WIDTH = 12;
// Droplets leave from across this many pixels of the surface, fanned within this many radians of straight up.
const LAUNCH_WIDTH = 14;
const ANGLE_SPREAD = 0.9;
// Each droplet's share of the tier's speed, repeating, so the spray has a ragged top instead of a smooth dome.
const SPEED_PATTERN = [1, 0.62, 0.86, 0.45, 0.74, 0.93, 0.55];
// The middle of the burst flies highest. The droplets at the edges keep this share of the speed.
const EDGE_SPEED_SHARE = 0.6;
// The sea's own colors from data/shaders/composite.frag: a light crest row over the water body.
const CREST_COLOR = '#b8e6ff';
const WATER_COLOR = '#295cd1';
// A droplet moving faster than this is drawn one pixel longer.
const STRETCH_SPEED = 3;

// The last knockout of a round is always large. Any other fall is small or medium by how fast it was.
export function splashTierFor(fallSpeed, lastKnockout = false) {
  if (lastKnockout) return 'large';
  return fallSpeed >= SPLASH_MEDIUM_FALL_SPEED ? 'medium' : 'small';
}

export class Splashes {
  constructor() {
    this.list = [];
  }

  attach(events, { getPlayers, getWaterLineY }) {
    events.on('player-fell-in-water', ({ playerId, splashTier = 'small' }) => {
      const player = getPlayers().find((candidate) => candidate.id === playerId);
      if (player) this.burst(player.x + PLAYER_HALF_WIDTH, getWaterLineY(), splashTier);
    });
  }

  // A crate lost to the sea makes a small splash where it went in.
  attachCrates(events) {
    events.on('crate-fell-in-water', ({ x, y }) => this.burst(x, y, 'small'));
  }

  burst(x, waterLineY, tierName) {
    const { dropletCount, dropletSpeed } = SPLASH_TIERS[tierName];
    for (let index = 0; index < dropletCount; index++) {
      const spread = (index + 0.5) / dropletCount - 0.5;
      const angle = -Math.PI / 2 + spread * 2 * ANGLE_SPREAD;
      const centerShare = 1 - (1 - EDGE_SPEED_SHARE) * Math.abs(spread) * 2;
      const speed = dropletSpeed * SPEED_PATTERN[index % SPEED_PATTERN.length] * centerShare;
      const size = index % 3 === 0 ? 3 : 2;
      const droplet = createParticle({
        x: x + spread * LAUNCH_WIDTH,
        y: waterLineY - 1,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        gravity: SPLASH_DROPLET_GRAVITY,
        lifeTicks: Infinity,
        sizes: [size],
        colors: [WATER_COLOR],
      });
      this.list.push({ ...droplet, waterLineY, size });
    }
  }

  update() {
    for (const droplet of this.list) stepParticle(droplet);
    this.list = this.list.filter((droplet) => droplet.velocityY < 0 || droplet.y < droplet.waterLineY);
  }
}

// Each droplet is water with a crest edge lit from the top left, like the sea surface, and stretches along its path
// when it moves fast.
export function drawSplashes(context, scene) {
  for (const droplet of scene.splashes.list) {
    const x = toPixel(droplet.x);
    const y = toPixel(droplet.y);
    const length = droplet.size + (Math.abs(droplet.velocityY) > STRETCH_SPEED ? 1 : 0);
    context.fillStyle = WATER_COLOR;
    context.fillRect(x, y, droplet.size, length);
    context.fillStyle = CREST_COLOR;
    context.fillRect(x, y, droplet.size, 1);
    context.fillRect(x, y, 1, length - 1);
  }
}
