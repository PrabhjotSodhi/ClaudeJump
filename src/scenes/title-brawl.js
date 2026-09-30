import {
  SCREEN_WIDTH,
  SHOVE_CHARGE_REPORT_INTERVAL_TICKS,
  SHOVE_MAX_CHARGE_TICKS,
  SHOVE_WINDUP_TICKS,
} from '../engine/config.js';
import { EventEmitter } from '../engine/events.js';
import { SeededRandom } from '../engine/seeded-random.js';
import { DEFAULT_CHARACTER_BY_PLAYER_ID } from '../entities/characters.js';
import { Platform } from '../entities/platform.js';
import { Player, SHOVE_KNOCKBACK_VELOCITY_X, SHOVE_KNOCKBACK_VELOCITY_Y } from '../entities/player.js';
import { drawParticles, HARD_LANDING_SPEED, Particles } from '../vfx/particles.js';
import { PlayerEyes } from '../vfx/player-eyes.js';

export const LEDGE_TOP_Y = 140;
const LEDGE_BLOCK_SIZE = 32;
const LEDGE_BLOCK_GAP = 2;
const LEDGE_BLOCK_SPRITE_NAMES = ['block-big-0', 'block-big-1', 'block-big-0', 'block-big-1', 'block-big-0'];
const LEDGE_BLOCK_STRIDE = LEDGE_BLOCK_SIZE + LEDGE_BLOCK_GAP;
const LEDGE_WIDTH = LEDGE_BLOCK_SPRITE_NAMES.length * LEDGE_BLOCK_STRIDE - LEDGE_BLOCK_GAP;
export const LEDGE_LEFT_X = (SCREEN_WIDTH - LEDGE_WIDTH) / 2;

// A character whose feet sink this far below the ledge top is out of the fight and respawns. The
// limit sits above the menu, so nobody ever falls behind its text.
export const RESPAWN_FEET_Y = LEDGE_TOP_Y + 30;
const SPAWN_INSET = 32;
const EDGE_MARGIN = 4;

const PLAYER_IDS = ['red', 'blue'];
const CLOSE_DISTANCE = 44;
const JUMP_HOLD_TICKS = 3;
const TAP_SHOVE_TICKS = 4;
const SHOVE_RECOVER_TICKS = 24;

const IDLE_INPUT = { left: false, right: false, jump: false, action: false };

function inputFor(direction, overrides = {}) {
  return { ...IDLE_INPUT, left: direction < 0, right: direction > 0, ...overrides };
}

// Two real players on a small ledge, fighting on their own from scripted inputs. Every choice comes
// from the seeded random and the players' positions, so the same seed plays out the same way.
export class TitleBrawl {
  constructor({ seed }) {
    this.random = new SeededRandom(seed);
    this.events = new EventEmitter();
    this.platform = new Platform({
      x: LEDGE_LEFT_X,
      y: LEDGE_TOP_Y,
      width: LEDGE_WIDTH,
      height: LEDGE_BLOCK_SIZE,
    });
    this.tickCount = 0;
    this.stepsByPlayerId = {};
    this.shoveHitIdsByShoverId = new Map();
    this.respawnCount = 0;
    this.players = PLAYER_IDS.map((id, index) => {
      this.stepsByPlayerId[id] = [];
      return this.spawnPlayer(id, index === 0 ? LEDGE_LEFT_X + SPAWN_INSET : LEDGE_LEFT_X + LEDGE_WIDTH - SPAWN_INSET);
    });
    this.playerEyes = new PlayerEyes();
    this.playerEyes.attach(this.events, () => this.players);
    this.particles = new Particles();
    this.particles.attach(this.events, {
      getPlayers: () => this.players,
      getWaterLineY: () => RESPAWN_FEET_Y,
      getTickCount: () => this.tickCount,
    });
  }

  spawnPlayer(id, x) {
    return new Player({
      id,
      character: DEFAULT_CHARACTER_BY_PLAYER_ID[id],
      spawnX: x,
      spawnY: LEDGE_TOP_Y,
      facing: x < SCREEN_WIDTH / 2 ? 1 : -1,
    });
  }

  update() {
    this.tickCount++;
    this.playerEyes.update();
    this.particles.update();
    for (const player of [...this.players]) this.updatePlayer(player);
    for (const player of this.players) if (player.isShoveActive) this.resolveShoveHit(player);
  }

  updatePlayer(player) {
    const fallSpeed = player.velocityY;
    const wasOnGround = player.onGround;
    player.update(this.scriptedInput(player), [this.platform]);
    const feet = { playerId: player.id, x: player.x + player.width / 2, y: player.y + player.height };
    if (player.ticksSinceJump === 0) this.events.emit('player-jumped', feet);
    if (player.onGround && !wasOnGround && fallSpeed >= HARD_LANDING_SPEED) this.events.emit('player-landed', feet);
    if (player.shoveJustFullyCharged) this.events.emit('shove-fully-charged', { playerId: player.id });
    if (player.shoveJustStarted) this.shoveHitIdsByShoverId.set(player.id, new Set());
    if (player.y + player.height >= RESPAWN_FEET_Y) this.respawn(player);
  }

  // Comes back on the side of the ledge farther from the other character.
  respawn(player) {
    const opponent = this.players.find((candidate) => candidate !== player);
    const leftX = LEDGE_LEFT_X + SPAWN_INSET;
    const rightX = LEDGE_LEFT_X + LEDGE_WIDTH - SPAWN_INSET;
    const opponentCenterX = opponent.x + opponent.width / 2;
    const x = Math.abs(opponentCenterX - leftX) > Math.abs(opponentCenterX - rightX) ? leftX : rightX;
    this.players[this.players.indexOf(player)] = this.spawnPlayer(player.id, x);
    this.stepsByPlayerId[player.id] = [];
    this.respawnCount++;
    this.events.emit('player-landed', { playerId: player.id, x, y: LEDGE_TOP_Y });
  }

  scriptedInput(player) {
    if (player.isFrozen) return IDLE_INPUT;
    const steps = this.stepsByPlayerId[player.id];
    if (steps.length === 0) steps.push(...this.planFor(player));
    const step = steps[0];
    if (--step.ticks <= 0) steps.shift();
    return this.keepOnLedge(player, step.input);
  }

  keepOnLedge(player, input) {
    const pastLeft = player.x < LEDGE_LEFT_X + EDGE_MARGIN;
    const pastRight = player.x + player.width > LEDGE_LEFT_X + LEDGE_WIDTH - EDGE_MARGIN;
    if ((input.left && pastLeft) || (input.right && pastRight)) return { ...input, left: false, right: false };
    return input;
  }

  randomTicks(minimum, maximum) {
    return minimum + Math.floor(this.random.next() * (maximum - minimum + 1));
  }

  // A plan is a list of { ticks, input } steps: walk toward the other character, hop, or shove
  // (a quick tap or a held charge) once close, then wait out the cooldown.
  planFor(player) {
    const opponent = this.players.find((candidate) => candidate !== player);
    const offset = opponent.x + opponent.width / 2 - (player.x + player.width / 2);
    const direction = Math.sign(offset) || player.facing;
    const roll = this.random.next();
    if (Math.abs(offset) > CLOSE_DISTANCE) {
      if (roll < 0.7) return [{ ticks: this.randomTicks(10, 30), input: inputFor(direction) }];
      if (roll < 0.85) return this.hopPlan(direction);
      return [{ ticks: this.randomTicks(10, 20), input: inputFor(0) }];
    }
    if (roll < 0.6) return this.shovePlan(player, direction);
    if (roll < 0.8) return [{ ticks: this.randomTicks(12, 24), input: inputFor(-direction) }];
    return this.hopPlan(direction);
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

  // Every other character touching the shover's hit zone is knocked away, once per shove.
  resolveShoveHit(shover) {
    const hitZone = shover.shoveHitZone;
    const alreadyHitIds = this.shoveHitIdsByShoverId.get(shover.id);
    for (const opponent of this.players) {
      if (opponent === shover || alreadyHitIds.has(opponent.id) || !opponent.overlaps(hitZone)) continue;
      alreadyHitIds.add(opponent.id);
      const strength = shover.shoveCharge >= 1 ? 'medium' : 'light';
      const multiplier = shover.shoveKnockbackMultiplier;
      opponent.freeze(
        strength,
        SHOVE_KNOCKBACK_VELOCITY_X * multiplier * shover.facing,
        SHOVE_KNOCKBACK_VELOCITY_Y * multiplier,
      );
      shover.freeze(strength);
      this.events.emit('player-shoved', {
        shoverId: shover.id,
        targetId: opponent.id,
        directionX: shover.facing,
        directionY: 0,
        strength,
        charge: shover.shoveCharge,
      });
    }
  }

  render(context, sprites) {
    LEDGE_BLOCK_SPRITE_NAMES.forEach((spriteName, index) => {
      context.drawImage(sprites.stoneBlocks[spriteName], LEDGE_LEFT_X + index * LEDGE_BLOCK_STRIDE, LEDGE_TOP_Y);
    });
    for (const player of this.players) player.render(context, { sprites, playerEyes: this.playerEyes });
    drawParticles(context, this);
  }
}
