import {
  SCREEN_WIDTH,
  SHOVE_CHARGE_REPORT_INTERVAL_TICKS,
  SHOVE_MAX_CHARGE_TICKS,
  SHOVE_WINDUP_TICKS,
} from '../engine/config.js';
import { EventEmitter } from '../engine/events.js';
import { SeededRandom } from '../engine/seeded-random.js';
import { HOVER_CHARACTER_BY_PLAYER_ID } from '../entities/characters.js';
import { Platform } from '../entities/platform.js';
import { Player } from '../entities/player.js';
import { resolveShoveHit } from '../entities/shove.js';
import { drawParticles, HARD_LANDING_SPEED, Particles } from '../vfx/particles.js';
import { CharacterAnimations } from '../vfx/character-animations.js';
import { PlayerEyes } from '../vfx/player-eyes.js';

const BLOCK_SIZE = 32;
const BLOCK_GAP = 2;
const BLOCK_STRIDE = BLOCK_SIZE + BLOCK_GAP;
const BLOCK_SPRITE_NAMES = ['block-big-0', 'block-big-1'];

// One wide ledge between the logo and the menu, and a lower ledge on each side of the menu, clear of
// the controls panel. Characters climb from the lower ledges to the upper one with a full jump, and
// only ever hop a little on the upper ledge so they never reach the logo.
const LOWER_LEDGE_WIDTH = 5 * BLOCK_STRIDE - BLOCK_GAP;
const LEDGES = [
  { leftX: 185, topY: 140, blockCount: 8 },
  { leftX: 10, topY: 205, blockCount: 5 },
  { leftX: SCREEN_WIDTH - 10 - LOWER_LEDGE_WIDTH, topY: 205, blockCount: 5 },
].map((ledge) => ({ ...ledge, width: ledge.blockCount * BLOCK_STRIDE - BLOCK_GAP }));
const [UPPER_LEDGE, LOWER_LEFT_LEDGE, LOWER_RIGHT_LEDGE] = LEDGES;

// A character whose feet sink this far below a lower ledge is out of the fight and drops back in from
// the top of the screen. The limit sits above the controls panel.
const RESPAWN_FEET_Y = LOWER_LEFT_LEDGE.topY + 30;
const RESPAWN_DROP_FEET_Y = -20;
const RESPAWN_SPREAD_PIXELS = 40;
const EDGE_MARGIN = 4;
// A character rising past this line stops there, so a big hit never carries one behind the logo.
const CEILING_Y = 66;

const SPAWNS = [
  { id: 'red', ledgeIndex: 1 },
  { id: 'blue', ledgeIndex: 2 },
  { id: 'green', ledgeIndex: 0, offsetX: -60 },
  { id: 'yellow', ledgeIndex: 0, offsetX: 60 },
];
const CLOSE_DISTANCE = 44;
const SAME_LEVEL_DISTANCE = 20;
const JUMP_HOLD_TICKS = 3;
const CLIMB_JUMP_HOLD_TICKS = 14;
const CLIMB_EDGE_DISTANCE = 30;
const CLIMB_CHANCE = 0.4;
const TAP_SHOVE_TICKS = 4;
const SHOVE_RECOVER_TICKS = 24;

const IDLE_INPUT = { left: false, right: false, jump: false, action: false };

function inputFor(direction, overrides = {}) {
  return { ...IDLE_INPUT, left: direction < 0, right: direction > 0, ...overrides };
}

function centerX(player) {
  return player.x + player.width / 2;
}

// Four real players on a few ledges, fighting on their own from scripted inputs. Every choice comes
// from the seeded random and the players' positions, so the same seed plays out the same way.
export class TitleBrawl {
  constructor({ seed, characterPoses }) {
    this.random = new SeededRandom(seed);
    this.events = new EventEmitter();
    this.platforms = LEDGES.map(
      (ledge) => new Platform({ x: ledge.leftX, y: ledge.topY, width: ledge.width, height: BLOCK_SIZE }),
    );
    this.tickCount = 0;
    this.stepsByPlayerId = {};
    this.ledgeByPlayerId = {};
    this.shoveHitIdsByShoverId = new Map();
    this.respawnCount = 0;
    this.players = SPAWNS.map(({ id, ledgeIndex, offsetX = 0 }) => {
      const ledge = LEDGES[ledgeIndex];
      this.stepsByPlayerId[id] = [];
      this.ledgeByPlayerId[id] = ledge;
      return this.createPlayer(id, ledge.leftX + ledge.width / 2 + offsetX, ledge.topY);
    });
    this.playerEyes = new PlayerEyes();
    this.playerEyes.attach(this.events, () => this.players);
    this.characterAnimations = new CharacterAnimations(characterPoses);
    this.characterAnimations.attach(() => this.players);
    this.particles = new Particles();
    this.particles.attach(this.events, {
      getPlayers: () => this.players,
      getWaterLineY: () => RESPAWN_FEET_Y,
      getTickCount: () => this.tickCount,
    });
  }

  createPlayer(id, x, feetY) {
    return new Player({
      id,
      character: HOVER_CHARACTER_BY_PLAYER_ID[id],
      spawnX: x,
      spawnY: feetY,
      facing: x < SCREEN_WIDTH / 2 ? 1 : -1,
    });
  }

  update() {
    this.tickCount++;
    this.playerEyes.update();
    this.characterAnimations.update();
    this.particles.update();
    for (const player of [...this.players]) this.updatePlayer(player);
    for (const shover of this.players) {
      if (!shover.isShoveActive) continue;
      resolveShoveHit({
        events: this.events,
        players: this.players,
        shover,
        alreadyHitIds: this.shoveHitIdsByShoverId.get(shover.id),
      });
    }
  }

  updatePlayer(player) {
    const fallSpeed = player.velocityY;
    const wasOnGround = player.onGround;
    player.update(this.scriptedInput(player), this.platforms);
    const feet = { playerId: player.id, x: centerX(player), y: player.y + player.height };
    if (player.ticksSinceJump === 0) this.events.emit('player-jumped', feet);
    if (player.onGround && !wasOnGround && fallSpeed >= HARD_LANDING_SPEED) this.events.emit('player-landed', feet);
    if (player.shoveJustFullyCharged) this.events.emit('shove-fully-charged', { playerId: player.id });
    if (player.shoveJustStarted) this.shoveHitIdsByShoverId.set(player.id, new Set());
    if (player.velocityY < 0 && player.y < CEILING_Y) {
      player.y = CEILING_Y;
      player.velocityY = 0;
    }
    if (this.isKnockedOut(player)) this.respawn(player);
  }

  // Out of the fight once it sinks below the lower ledges, or falls under the upper ledge, where the
  // menu is.
  isKnockedOut(player) {
    const feetY = player.y + player.height;
    const underUpperLedge =
      feetY > UPPER_LEDGE.topY + BLOCK_SIZE &&
      centerX(player) > UPPER_LEDGE.leftX &&
      centerX(player) < UPPER_LEDGE.leftX + UPPER_LEDGE.width;
    return feetY >= RESPAWN_FEET_Y || underUpperLedge;
  }

  // Drops back in from the top of the screen above the lower ledge with fewer characters on it.
  respawn(player) {
    const others = this.players.filter((candidate) => candidate !== player);
    const onLeft = others.filter((other) => centerX(other) < SCREEN_WIDTH / 2).length;
    const ledge = onLeft <= others.length - onLeft ? LOWER_LEFT_LEDGE : LOWER_RIGHT_LEDGE;
    const spread = this.randomTicks(-RESPAWN_SPREAD_PIXELS, RESPAWN_SPREAD_PIXELS);
    const x = ledge.leftX + ledge.width / 2 + spread;
    this.players[this.players.indexOf(player)] = this.createPlayer(player.id, x, RESPAWN_DROP_FEET_Y);
    this.stepsByPlayerId[player.id] = [];
    this.ledgeByPlayerId[player.id] = ledge;
    this.respawnCount++;
  }

  scriptedInput(player) {
    if (player.onGround) this.ledgeByPlayerId[player.id] = this.ledgeUnder(player) ?? this.ledgeByPlayerId[player.id];
    if (player.isFrozen) return IDLE_INPUT;
    const steps = this.stepsByPlayerId[player.id];
    if (steps.length === 0) steps.push(...this.planFor(player));
    const step = steps[0];
    if (--step.ticks <= 0) steps.shift();
    return this.keepOnLedge(player, step.input);
  }

  ledgeUnder(player) {
    const feetY = player.y + player.height;
    return LEDGES.find(
      (ledge) => ledge.topY === feetY && player.x < ledge.leftX + ledge.width && player.x + player.width > ledge.leftX,
    );
  }

  // Walking stops at the edge, so only a knock or a deliberate jump ever leaves a ledge.
  keepOnLedge(player, input) {
    if (!player.onGround) return input;
    const ledge = this.ledgeByPlayerId[player.id];
    const pastLeft = player.x < ledge.leftX + EDGE_MARGIN;
    const pastRight = player.x + player.width > ledge.leftX + ledge.width - EDGE_MARGIN;
    if (!input.jump && ((input.left && pastLeft) || (input.right && pastRight))) {
      return { ...input, left: false, right: false };
    }
    return input;
  }

  randomTicks(minimum, maximum) {
    return minimum + Math.floor(this.random.next() * (maximum - minimum + 1));
  }

  nearestOpponent(player) {
    const distanceTo = (other) => Math.abs(centerX(other) - centerX(player)) + Math.abs(other.y - player.y);
    return this.players
      .filter((candidate) => candidate !== player)
      .reduce((nearest, candidate) => (distanceTo(candidate) < distanceTo(nearest) ? candidate : nearest));
  }

  // A plan is a list of { ticks, input } steps. On the same level a character walks toward the
  // opponent, hops, or shoves (a quick tap or a held charge) once close, then waits out the cooldown.
  // Below the opponent it walks to the ledge edge and jumps up. Above the opponent it waits.
  planFor(player) {
    const opponent = this.nearestOpponent(player);
    const offset = centerX(opponent) - centerX(player);
    const direction = Math.sign(offset) || player.facing;
    const roll = this.random.next();
    const heightGap = opponent.y - player.y;
    if (heightGap < -SAME_LEVEL_DISTANCE) {
      return roll < CLIMB_CHANCE ? this.climbPlan(player, direction) : this.hopPlan(direction);
    }
    if (heightGap > SAME_LEVEL_DISTANCE) return [{ ticks: this.randomTicks(10, 20), input: inputFor(0) }];
    if (Math.abs(offset) > CLOSE_DISTANCE) {
      if (roll < 0.7) return [{ ticks: this.randomTicks(10, 30), input: inputFor(direction) }];
      if (roll < 0.85) return this.hopPlan(direction);
      return [{ ticks: this.randomTicks(10, 20), input: inputFor(0) }];
    }
    if (roll < 0.6) return this.shovePlan(player, direction);
    if (roll < 0.8) return [{ ticks: this.randomTicks(12, 24), input: inputFor(-direction) }];
    return this.hopPlan(direction);
  }

  climbPlan(player, direction) {
    const ledge = this.ledgeByPlayerId[player.id];
    const edgeDistance = direction > 0 ? ledge.leftX + ledge.width - (player.x + player.width) : player.x - ledge.leftX;
    if (edgeDistance > CLIMB_EDGE_DISTANCE) return [{ ticks: this.randomTicks(10, 20), input: inputFor(direction) }];
    return [
      { ticks: CLIMB_JUMP_HOLD_TICKS, input: inputFor(direction, { jump: true }) },
      { ticks: this.randomTicks(24, 36), input: inputFor(direction) },
    ];
  }

  hopPlan(direction) {
    return [
      { ticks: JUMP_HOLD_TICKS, input: inputFor(direction, { jump: true }) },
      { ticks: this.randomTicks(16, 30), input: inputFor(direction) },
    ];
  }

  shovePlan(player, direction) {
    const charged = this.random.next() < 0.5;
    const holdTicks = charged ? SHOVE_MAX_CHARGE_TICKS + SHOVE_CHARGE_REPORT_INTERVAL_TICKS : TAP_SHOVE_TICKS;
    const steps = [];
    if (player.facing !== direction) steps.push({ ticks: 1, input: inputFor(direction) });
    steps.push({ ticks: Math.max(holdTicks, SHOVE_WINDUP_TICKS), input: inputFor(0, { action: true }) });
    steps.push({ ticks: SHOVE_RECOVER_TICKS, input: inputFor(0) });
    return steps;
  }

  render(context, sprites) {
    for (const ledge of LEDGES) {
      for (let index = 0; index < ledge.blockCount; index++) {
        const spriteName = BLOCK_SPRITE_NAMES[index % BLOCK_SPRITE_NAMES.length];
        context.drawImage(sprites.stoneBlocks[spriteName], ledge.leftX + index * BLOCK_STRIDE, ledge.topY);
      }
    }
    this.characterAnimations.render(context);
    const appearance = { sprites, playerEyes: this.playerEyes, characterAnimations: this.characterAnimations };
    for (const player of this.players) player.render(context, appearance);
    for (const player of this.players) player.renderLandedShovel(context, sprites);
    drawParticles(context, this);
  }
}
