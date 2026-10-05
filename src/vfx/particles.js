// Dust, sparks and launch trails. Display only: it listens to events and watches the players once per tick, and is
// never read by game logic. Every particle follows the rules in particle-rules.js, with its small variations from
// this effect's own seeded random, so the same events always throw the same particles. Dust kicks up behind running
// feet and on turns, jumps and landings. Hit sparks fly in a cone along the direction the hit went, in front of the
// characters, and a player launched by a medium or heavy hit leaves a trail until their knockback slows down.
import {
  CHARGED_SHOVE_EXTRA_SPARK_SPEED,
  CHARGED_SHOVE_EXTRA_SPARKS,
  IMPACT_EFFECTS,
  LAUNCH_TRAIL_MIN_SPEED,
  LAUNCH_TRAIL_STRENGTHS,
} from '../engine/config.js';
import { SeededRandom } from '../engine/seeded-random.js';
import { createParticle, drawParticle, RAMPS, sparkRamp, stepParticle, trailRamp, varied } from './particle-rules.js';

const CRAB_COLOR = '#e43b44';
const SPRING_COLOR = '#feae34';
const SPARKLE_COLOR = '#fee761';
const PLAYER_HALF_WIDTH = 12;
const PLAYER_HALF_HEIGHT = 14;
const RANDOM_SEED = 11;
// How much each particle's speed and life vary, as a share, and its angle, in radians.
const SPEED_VARIATION = 0.25;
const LIFE_VARIATION = 0.2;
const ANGLE_VARIATION = 0.26;

// A burst throws `count` sparks at evenly spaced angles across the arc, each nudged by the variations above.
const SPARK = { drag: 0.86, gravity: 0.05 };
const HIT_SPARKS = { count: 8, speed: 3, ticks: 10, sizes: [2, 2, 1], arcStart: 0, arcSize: 2 * Math.PI };
const FULL_CHARGE_SPARKLE = { count: 6, speed: 1.5, ticks: 12, sizes: [2, 1], arcStart: 0, arcSize: 2 * Math.PI };
const BLAST_SPARKS = { count: 16, speed: 4.5, ticks: 18, sizes: [3, 2, 1], arcStart: 0, arcSize: 2 * Math.PI };
const SPRING_BURST = { count: 6, speed: 1.6, ticks: 14, sizes: [2, 1], arcStart: Math.PI, arcSize: Math.PI };
const HIT_SPARK_CONE = Math.PI / 2;

// Dust leaves the feet sideways and drifts up a little as it slows. It starts at the edge of the body, since it draws
// behind the characters.
const DUST = { sizes: [3, 2, 1], drag: 0.92, gravity: -0.01 };
const FOOT_EDGE_PIXELS = 11;
// The slowest puff of a fan moves at this share of the speed, and rises this many times higher than the fastest.
const DUST_FAN = { slowest: 0.4, highestRise: 2 };
const JUMP_DUST = { count: 4, speedX: 0.7, speedY: -0.25, ticks: 17 };
// Landings throw more dust, faster and bigger, the harder the fall. A fall slower than the minimum throws none.
const LAND_DUST_MIN_FALL_SPEED = 2;
const LAND_DUST_FULL_FALL_SPEED = 12;
// Running kicks a puff back from the feet every few ticks, and turning around kicks a few at once.
const RUN_DUST_MIN_SPEED = 1.5;
const RUN_DUST_INTERVAL_TICKS = 8;
const RUN_DUST = { speedX: 0.35, speedY: -0.2, ticks: 16 };
// Each turn puff is slower than the one before, so they spread out instead of piling up.
const TURN_DUST = { count: 3, speedX: 1.2, slowerPerPuff: 0.3, speedY: -0.3, ticks: 16 };
// A player slipping on the ground leaves skid dust at their trailing foot every other tick.
const SKID_DUST = { speedX: 0.4, speedY: -0.3, ticks: 14 };
const LAUNCH_TRAIL = { sizes: [8, 6, 4], ticks: 10 };

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

// How a landing at this fall speed throws its dust.
export function landDustStyle(fallSpeed) {
  const range = LAND_DUST_FULL_FALL_SPEED - LAND_DUST_MIN_FALL_SPEED;
  const hardness = Math.min(1, Math.max(0, (fallSpeed - LAND_DUST_MIN_FALL_SPEED) / range));
  return {
    count: 4 + 2 * Math.round(3 * hardness),
    speedX: 0.8 + hardness,
    speedY: -0.2 - 0.4 * hardness,
    ticks: 18 + Math.round(8 * hardness),
    sizes: hardness >= 0.5 ? [4, 3, 2, 1] : DUST.sizes,
  };
}

export class Particles {
  constructor() {
    this.list = [];
    this.launchedPlayerIds = new Set();
    this.random = new SeededRandom(RANDOM_SEED);
    // What each player's feet did last tick, to spot jumps, landings and turns:
    // { onGround, feetY, velocityY, runDirection, runTicks }. runDirection is the way they last ran on the ground.
    this.feetByPlayerId = new Map();
    this.getPlayers = () => [];
  }

  attach(events, { getPlayers }) {
    this.getPlayers = getPlayers;
    const findPlayer = (playerId) => getPlayers().find((candidate) => candidate.id === playerId);
    const centerOf = (player) => ({ x: player.x + PLAYER_HALF_WIDTH, y: player.y + PLAYER_HALF_HEIGHT });
    const hitBurst = (x, y, color, { strength = 'light', directionX = 0, directionY = -1, charge = 0 }) =>
      this.burst(x, y, sparkRamp(color), hitSparkStyle(strength, directionX, directionY, charge));
    const sparksAt = (player, colors, style = HIT_SPARKS) =>
      this.burst(centerOf(player).x, centerOf(player).y, colors, style);

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
      if (player) sparksAt(player, sparkRamp(SPARKLE_COLOR), FULL_CHARGE_SPARKLE);
    });
    events.on('trap-sprung', (hit) => {
      const owner = findPlayer(hit.ownerId);
      const target = findPlayer(hit.targetId);
      if (owner && target) hitBurst(centerOf(target).x, centerOf(target).y, owner.color, hit);
      this.markLaunched([hit.targetId], hit.strength);
    });
    events.on('player-burned', ({ playerId }) => {
      const player = findPlayer(playerId);
      if (player) this.burst(centerOf(player).x, player.y + player.height, RAMPS.fire, HIT_SPARKS);
    });
    events.on('card-played', ({ playerId }) => {
      const player = findPlayer(playerId);
      if (player) sparksAt(player, sparkRamp(player.color));
    });
    events.on('magnet-pulled', ({ playerId, targetIds }) => {
      const puller = findPlayer(playerId);
      if (!puller) return;
      for (const target of targetIds.map(findPlayer)) {
        if (target) sparksAt(target, sparkRamp(puller.color));
      }
    });
    events.on('spring-jumped', ({ x, y }) => this.burst(x, y, sparkRamp(SPRING_COLOR), SPRING_BURST));
    events.on('player-iced', ({ targetId, x, y }) => {
      const target = findPlayer(targetId);
      if (target) sparksAt(target, RAMPS.ice, BLAST_SPARKS);
      this.burst(x, y, RAMPS.ice, HIT_SPARKS);
    });
    events.on('ice-shattered', ({ x, y }) => this.burst(x, y, RAMPS.ice, HIT_SPARKS));
    events.on('bomb-passed', ({ fromId, toId }) => {
      const passer = findPlayer(fromId);
      const receiver = findPlayer(toId);
      if (passer && receiver) sparksAt(receiver, sparkRamp(passer.color));
    });
    events.on('player-respawned', ({ x, y }) => this.kickDust(x, y, landDustStyle(HARD_LANDING_SPEED)));
    events.on('crab-stomped', ({ x, y }) => this.burst(x, y, sparkRamp(CRAB_COLOR), HIT_SPARKS));
    events.on('player-pinched', (hit) => {
      const player = findPlayer(hit.playerId);
      if (player) hitBurst(centerOf(player).x, centerOf(player).y, CRAB_COLOR, hit);
      this.markLaunched([hit.playerId], hit.strength);
    });
    events.on('block-broken', ({ x, y, size }) =>
      this.kickDust(x + size / 2, y + size / 2, landDustStyle(HARD_LANDING_SPEED)),
    );
    events.on('rocket-exploded', ({ x, y, playerIds = [], strength }) => {
      this.burst(x, y, RAMPS.fire, BLAST_SPARKS);
      this.markLaunched(playerIds, strength);
    });
    events.on('bomb-exploded', ({ x, y, playerIds = [], strength }) => {
      this.burst(x, y, RAMPS.fire, BLAST_SPARKS);
      this.markLaunched(playerIds, strength);
    });
  }

  // Sparks in front of the characters, spread across the style's arc.
  burst(x, y, colors, style) {
    for (let index = 0; index < style.count; index++) {
      const evenAngle = style.arcStart + ((index + 0.5) / style.count) * style.arcSize;
      const angle = evenAngle + (this.random.next() * 2 - 1) * ANGLE_VARIATION;
      const speed = varied(this.random, style.speed, SPEED_VARIATION);
      this.list.push(
        createParticle({
          x,
          y,
          velocityX: Math.cos(angle) * speed,
          velocityY: Math.sin(angle) * speed,
          gravity: SPARK.gravity,
          drag: SPARK.drag,
          lifeTicks: Math.round(varied(this.random, style.ticks, LIFE_VARIATION)),
          sizes: style.sizes,
          colors,
          layer: 'front',
          glows: colors === RAMPS.fire,
        }),
      );
    }
  }

  // Dust spreading sideways from under a body's middle on the ground, half of it each way. On each side the puffs fan
  // out from slow ones that rise to fast ones that skim the ground, so they spread instead of piling up.
  kickDust(x, y, style) {
    const perSide = Math.ceil(style.count / 2);
    for (let index = 0; index < style.count; index++) {
      const share = perSide > 1 ? Math.floor(index / 2) / (perSide - 1) : 1;
      this.addDust(x, y, index % 2 === 0 ? -1 : 1, {
        ...style,
        speedX: style.speedX * (DUST_FAN.slowest + (1 - DUST_FAN.slowest) * share),
        speedY: style.speedY * (DUST_FAN.highestRise - (DUST_FAN.highestRise - 1) * share),
      });
    }
  }

  // One puff of dust leaving the feet of a body centered on x, from its edge, the given way along the ground.
  addDust(x, y, directionX, { speedX, speedY, ticks, sizes = DUST.sizes }) {
    this.list.push(
      createParticle({
        x: x + directionX * FOOT_EDGE_PIXELS,
        y: y - 1,
        velocityX: directionX * varied(this.random, speedX, SPEED_VARIATION),
        velocityY: varied(this.random, speedY, SPEED_VARIATION),
        gravity: DUST.gravity,
        drag: DUST.drag,
        lifeTicks: Math.round(varied(this.random, ticks, LIFE_VARIATION)),
        sizes,
        colors: RAMPS.dust,
      }),
    );
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
      if (!player || player.inWater || slowedDown) {
        this.launchedPlayerIds.delete(playerId);
        continue;
      }
      if (player.isFrozen) continue;
      this.list.push(
        createParticle({
          x: player.x + PLAYER_HALF_WIDTH,
          y: player.y + PLAYER_HALF_HEIGHT,
          lifeTicks: LAUNCH_TRAIL.ticks,
          sizes: LAUNCH_TRAIL.sizes,
          colors: trailRamp(player.color),
        }),
      );
    }
  }

  // Jump, landing, run, turn and skid dust, from what each player's feet did since last tick. Jump dust stays on the
  // ground the player left.
  addFootDust() {
    for (const player of this.getPlayers()) {
      const feetX = player.x + PLAYER_HALF_WIDTH;
      const feetY = player.y + player.height;
      const last = this.feetByPlayerId.get(player.id) ?? {
        onGround: true,
        feetY,
        velocityY: 0,
        runDirection: 0,
        runTicks: 0,
      };
      const direction = Math.sign(player.velocityX);
      const grounded = player.onGround && !player.inWater;
      const running = grounded && Math.abs(player.velocityX) >= RUN_DUST_MIN_SPEED;
      const runTicks = running ? last.runTicks + 1 : 0;
      if (!player.onGround && last.onGround && player.velocityY < 0) {
        this.kickDust(feetX, last.feetY, JUMP_DUST);
      } else if (grounded && !last.onGround) {
        if (last.velocityY >= LAND_DUST_MIN_FALL_SPEED) this.kickDust(feetX, feetY, landDustStyle(last.velocityY));
      } else if (running && last.runDirection !== 0 && direction !== last.runDirection) {
        for (let puff = 0; puff < TURN_DUST.count; puff++) {
          const speedX = TURN_DUST.speedX * (1 - puff * TURN_DUST.slowerPerPuff);
          this.addDust(feetX, feetY, -direction, { ...TURN_DUST, speedX });
        }
      } else if (running && runTicks % RUN_DUST_INTERVAL_TICKS === 1) {
        this.addDust(feetX, feetY, -direction, RUN_DUST);
      }
      if (grounded && player.slipTicksRemaining > 0 && player.slipTicksRemaining % 2 === 0) {
        this.addDust(feetX, feetY, -player.slipDirection, SKID_DUST);
      }
      this.feetByPlayerId.set(player.id, {
        onGround: player.onGround,
        feetY,
        velocityY: player.velocityY,
        runDirection: grounded ? (running ? direction : last.runDirection) : 0,
        runTicks,
      });
    }
  }

  update() {
    this.addLaunchTrails();
    this.addFootDust();
    this.list = this.list.filter(stepParticle);
  }
}

// layer is 'behind' to draw before the characters and 'front' to draw after them. Glowing particles also draw onto
// glowContext.
export function drawParticles(context, scene, layer, glowContext) {
  for (const particle of scene.particles.list) {
    if (particle.layer !== layer) continue;
    drawParticle(context, particle);
    if (particle.glows && glowContext) drawParticle(glowContext, particle);
  }
}
