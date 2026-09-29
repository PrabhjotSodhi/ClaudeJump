// Dust, sparks and droplets. Display only: it listens to events, moves particles once per tick
// and is never read by game logic. Nothing here is random. Bursts spread particles at evenly
// spaced angles, and the small offsets come from the tick count, so the same events always
// throw the same particles.
const DUST_COLOR = '#c8ccd4';
const BLAST_COLOR = '#ffd23c';
const DROPLET_COLOR = '#b8e0ff';
const PLAYER_HALF_WIDTH = 12;
const PLAYER_HALF_HEIGHT = 14;

const JUMP_DUST = { count: 6, speed: 1.2, ticks: 16, size: 2, gravity: 0.05, arcStart: Math.PI, arcSize: Math.PI };
const LANDING_DUST = { count: 10, speed: 1.8, ticks: 20, size: 3, gravity: 0.05, arcStart: Math.PI, arcSize: Math.PI };
const HIT_SPARKS = { count: 8, speed: 3, ticks: 14, size: 2, gravity: 0.12, arcStart: 0, arcSize: 2 * Math.PI };
const BLAST_SPARKS = { count: 20, speed: 4.5, ticks: 22, size: 3, gravity: 0.12, arcStart: 0, arcSize: 2 * Math.PI };
const SPLASH_DROPLETS = { count: 12, speed: 4, ticks: 30, size: 2, gravity: 0.22, arcStart: Math.PI, arcSize: Math.PI };

export const HARD_LANDING_SPEED = 9;

export class Particles {
  constructor() {
    this.list = [];
  }

  attach(events, { getPlayers, getWaterLineY, getTickCount }) {
    const findPlayer = (playerId) => getPlayers().find((candidate) => candidate.id === playerId);
    const centerOf = (player) => ({ x: player.x + PLAYER_HALF_WIDTH, y: player.y + PLAYER_HALF_HEIGHT });
    const burst = (x, y, color, style) => this.burst(x, y, color, style, getTickCount());

    events.on('player-jumped', ({ x, y }) => burst(x, y, DUST_COLOR, JUMP_DUST));
    events.on('player-landed', ({ x, y }) => burst(x, y, DUST_COLOR, LANDING_DUST));
    events.on('dash-hit', ({ playerIds }) => {
      const [playerA, playerB] = playerIds.map(findPlayer);
      if (!playerA || !playerB) return;
      const midpointX = (centerOf(playerA).x + centerOf(playerB).x) / 2;
      const midpointY = (centerOf(playerA).y + centerOf(playerB).y) / 2;
      burst(midpointX, midpointY, playerA.color, HIT_SPARKS);
      burst(midpointX, midpointY, playerB.color, HIT_SPARKS);
    });
    events.on('player-shoved', ({ shoverId, targetId }) => {
      const shover = findPlayer(shoverId);
      const target = findPlayer(targetId);
      if (shover && target) burst(centerOf(target).x, centerOf(target).y, shover.color, HIT_SPARKS);
    });
    events.on('trap-sprung', ({ ownerId, targetId }) => {
      const owner = findPlayer(ownerId);
      const target = findPlayer(targetId);
      if (owner && target) burst(centerOf(target).x, centerOf(target).y, owner.color, HIT_SPARKS);
    });
    events.on('card-played', ({ playerId }) => {
      const player = findPlayer(playerId);
      if (player) burst(centerOf(player).x, centerOf(player).y, player.color, HIT_SPARKS);
    });
    events.on('block-broken', ({ x, y, size }) => burst(x + size / 2, y + size / 2, DUST_COLOR, LANDING_DUST));
    events.on('rocket-exploded', ({ x, y }) => burst(x, y, BLAST_COLOR, BLAST_SPARKS));
    events.on('bomb-exploded', ({ x, y }) => burst(x, y, BLAST_COLOR, BLAST_SPARKS));
    events.on('player-fell-in-water', ({ playerId }) => {
      const player = findPlayer(playerId);
      if (player) burst(centerOf(player).x, getWaterLineY(), DROPLET_COLOR, SPLASH_DROPLETS);
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

  update() {
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
