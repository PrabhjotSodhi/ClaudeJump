// Dust, sparks, droplets and launch trails. Display only: it listens to events, moves particles once per tick
// and is never read by game logic. Nothing here is random. Bursts spread particles at evenly
// spaced angles, and the small offsets come from the tick count, so the same events always
// throw the same particles. Hit sparks fly in a cone along the direction the hit went, and a
// player launched by a medium or heavy hit leaves a trail until their knockback slows down.
import {
  CHARGED_SHOVE_EXTRA_SPARK_SPEED,
  CHARGED_SHOVE_EXTRA_SPARKS,
  IMPACT_EFFECTS,
  SPLASH_TIERS,
  LAUNCH_TRAIL_MIN_SPEED,
  LAUNCH_TRAIL_STRENGTHS,
} from '../engine/config.js';

const DUST_COLOR = '#c8ccd4';
const FIRE_COLOR = '#f77622';
const BLAST_COLOR = '#ffd23c';
const CRAB_COLOR = '#e43b44';
const DROPLET_COLORS = ['#c0cbdc', '#2ce8f5', '#ffffff'];
const PLAYER_HALF_WIDTH = 12;
const PLAYER_HALF_HEIGHT = 14;

const JUMP_DUST = { count: 6, speed: 1.2, ticks: 16, size: 2, gravity: 0.05, arcStart: Math.PI, arcSize: Math.PI };
const LANDING_DUST = { count: 10, speed: 1.8, ticks: 20, size: 3, gravity: 0.05, arcStart: Math.PI, arcSize: Math.PI };
const HIT_SPARKS = { count: 8, speed: 3, ticks: 14, size: 2, gravity: 0.12, arcStart: 0, arcSize: 2 * Math.PI };
const SPARKLE_COLOR = '#fee761';
const FULL_CHARGE_SPARKLE = { count: 6, speed: 1.5, ticks: 12, size: 2, gravity: 0, arcStart: 0, arcSize: 2 * Math.PI };
const HIT_SPARK_CONE = Math.PI / 2;
const LAUNCH_TRAIL = { size: 8, ticks: 10 };
const BLAST_SPARKS = { count: 20, speed: 4.5, ticks: 22, size: 3, gravity: 0.12, arcStart: 0, arcSize: 2 * Math.PI };
const SPLASH_DROPLETS = { ticks: 30, size: 2, gravity: 0.22, arcStart: Math.PI + 0.4, arcSize: Math.PI - 0.8 };

export const HARD_LANDING_SPEED = 9;

function hitSparkStyle(strength, directionX, directionY, charge) {
  const { sparkCount, sparkSpeed } = IMPACT_EFFECTS[strength];
  const angle = Math.atan2(directionY, directionX);
  return {
    ...HIT_SPARKS,
    count: sparkCount + Math.round(charge * CHARGED_SHOVE_EXTRA_SPARKS),
    speed: sparkSpeed + charge * CHARGED_SHOVE_EXTRA_SPARK_SPEED,
    arcStart: angle - HIT_SPARK_CONE / 2,
    arcSize: HIT_SPARK_CONE,
  };
}

export class Particles {
  constructor() {
    this.list = [];
    this.launchedPlayerIds = new Set();
    this.getPlayers = () => [];
  }

  attach(events, { getPlayers, getWaterLineY, getTickCount }) {
    this.getPlayers = getPlayers;
    const findPlayer = (playerId) => getPlayers().find((candidate) => candidate.id === playerId);
    const centerOf = (player) => ({ x: player.x + PLAYER_HALF_WIDTH, y: player.y + PLAYER_HALF_HEIGHT });
    const burst = (x, y, color, style) => this.burst(x, y, color, style, getTickCount());
    const hitBurst = (x, y, color, { strength = 'light', directionX = 0, directionY = -1, charge = 0 }) =>
      burst(x, y, color, hitSparkStyle(strength, directionX, directionY, charge));

    events.on('player-jumped', ({ x, y }) => burst(x, y, DUST_COLOR, JUMP_DUST));
    events.on('player-landed', ({ x, y }) => burst(x, y, DUST_COLOR, LANDING_DUST));
    events.on('dash-hit', ({ playerIds, strength = 'medium' }) => {
      const [playerA, playerB] = playerIds.map(findPlayer);
      if (!playerA || !playerB) return;
      const midpointX = (centerOf(playerA).x + centerOf(playerB).x) / 2;
      const midpointY = (centerOf(playerA).y + centerOf(playerB).y) / 2;
      const directionAToB = Math.sign(playerB.x - playerA.x) || 1;
      hitBurst(midpointX, midpointY, playerA.color, { strength, directionX: directionAToB, directionY: 0 });
      hitBurst(midpointX, midpointY, playerB.color, { strength, directionX: -directionAToB, directionY: 0 });
      this.markLaunched(playerIds, strength);
    });
    events.on('player-shoved', (hit) => {
      const shover = findPlayer(hit.shoverId);
      const target = findPlayer(hit.targetId);
      if (shover && target) hitBurst(centerOf(target).x, centerOf(target).y, shover.color, hit);
      this.markLaunched([hit.targetId], hit.strength);
    });
    events.on('shove-fully-charged', ({ playerId }) => {
      const player = findPlayer(playerId);
      if (player) burst(centerOf(player).x, centerOf(player).y, SPARKLE_COLOR, FULL_CHARGE_SPARKLE);
    });
    events.on('trap-sprung', (hit) => {
      const owner = findPlayer(hit.ownerId);
      const target = findPlayer(hit.targetId);
      if (owner && target) hitBurst(centerOf(target).x, centerOf(target).y, owner.color, hit);
      this.markLaunched([hit.targetId], hit.strength);
    });
    events.on('player-burned', ({ playerId }) => {
      const player = findPlayer(playerId);
      if (player) burst(centerOf(player).x, player.y + player.height, FIRE_COLOR, HIT_SPARKS);
    });
    events.on('card-played', ({ playerId }) => {
      const player = findPlayer(playerId);
      if (player) burst(centerOf(player).x, centerOf(player).y, player.color, HIT_SPARKS);
    });
    events.on('crab-stomped', ({ x, y }) => burst(x, y, CRAB_COLOR, HIT_SPARKS));
    events.on('player-pinched', (hit) => {
      const player = findPlayer(hit.playerId);
      if (player) hitBurst(centerOf(player).x, centerOf(player).y, CRAB_COLOR, hit);
      this.markLaunched([hit.playerId], hit.strength);
    });
    events.on('block-broken', ({ x, y, size }) => burst(x + size / 2, y + size / 2, DUST_COLOR, LANDING_DUST));
    events.on('rocket-exploded', ({ x, y, playerIds = [], strength }) => {
      burst(x, y, BLAST_COLOR, BLAST_SPARKS);
      this.markLaunched(playerIds, strength);
    });
    events.on('bomb-exploded', ({ x, y, playerIds = [], strength }) => {
      burst(x, y, BLAST_COLOR, BLAST_SPARKS);
      this.markLaunched(playerIds, strength);
    });
    events.on('player-fell-in-water', ({ playerId, splashTier = 'small' }) => {
      const player = findPlayer(playerId);
      if (!player) return;
      const { dropletCount, dropletSpeed } = SPLASH_TIERS[splashTier];
      DROPLET_COLORS.forEach((color, colorIndex) => {
        const count = Math.ceil((dropletCount - colorIndex) / DROPLET_COLORS.length);
        burst(centerOf(player).x, getWaterLineY(), color, { ...SPLASH_DROPLETS, count, speed: dropletSpeed });
      });
    });
  }

  burst(x, y, color, style, tickCount) {
    for (let index = 0; index < style.count; index++) {
      const angle = style.arcStart + ((index + 0.5) / style.count) * style.arcSize;
      const speed = style.speed * (0.7 + ((tickCount + index * 3) % 4) * 0.1);
      this.list.push({
        x,
        y,
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        gravity: style.gravity,
        ticksRemaining: style.ticks - ((tickCount + index) % 3),
        totalTicks: style.ticks,
        color,
        size: style.size,
      });
    }
  }

  markLaunched(playerIds, strength) {
    if (!LAUNCH_TRAIL_STRENGTHS.includes(strength)) return;
    for (const playerId of playerIds) this.launchedPlayerIds.add(playerId);
  }

  // A launched player trails from the end of the hit freeze until their knockback drops below the
  // minimum speed. Only the player is read, never changed.
  addLaunchTrails() {
    for (const playerId of [...this.launchedPlayerIds]) {
      const player = this.getPlayers().find((candidate) => candidate.id === playerId);
      const slowedDown = player && !player.isFrozen && Math.abs(player.knockbackVelocityX) < LAUNCH_TRAIL_MIN_SPEED;
      if (!player || player.inWater || slowedDown) this.launchedPlayerIds.delete(playerId);
      else if (!player.isFrozen) this.addTrailSquare(player);
    }
  }

  addTrailSquare(player) {
    this.list.push({
      x: player.x + PLAYER_HALF_WIDTH - LAUNCH_TRAIL.size / 2,
      y: player.y + PLAYER_HALF_HEIGHT - LAUNCH_TRAIL.size / 2,
      velocityX: 0,
      velocityY: 0,
      gravity: 0,
      ticksRemaining: LAUNCH_TRAIL.ticks,
      totalTicks: LAUNCH_TRAIL.ticks,
      color: player.color,
      size: LAUNCH_TRAIL.size,
    });
  }

  update() {
    this.addLaunchTrails();
    for (const particle of this.list) {
      particle.x += particle.velocityX;
      particle.y += particle.velocityY;
      particle.velocityY += particle.gravity;
      particle.ticksRemaining--;
    }
    this.list = this.list.filter((particle) => particle.ticksRemaining > 0);
  }
}

export function drawParticles(context, scene) {
  for (const particle of scene.particles.list) {
    context.globalAlpha = Math.min(1, (2 * particle.ticksRemaining) / particle.totalTicks);
    context.fillStyle = particle.color;
    context.fillRect(Math.round(particle.x), Math.round(particle.y), particle.size, particle.size);
  }
  context.globalAlpha = 1;
}
