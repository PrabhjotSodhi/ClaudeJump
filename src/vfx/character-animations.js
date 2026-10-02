import { SHOVE_MAX_CHARGE_TICKS, SHOVE_WINDUP_TICKS } from '../engine/config.js';
import { SeededRandom } from '../engine/seeded-random.js';
import { CHARACTERS } from '../entities/characters.js';

// Every action has a folder of pose frames in data/images/entities/player/<action>/frames.json. A frame changes how
// the one body sprite is drawn: width and height add to its size, x moves it forward in the facing direction, y moves
// it down, eyes "closed" shuts the eyes and dust kicks up a puff at the feet as the frame starts. The victory pose is
// each character's own, in data/images/entities/player/victory/<character name>.json.
export const CHARACTER_ACTIONS = ['idle', 'run', 'jump', 'fall', 'windup', 'charge', 'swing', 'hurt', 'launched'];

const RUN_SPEED_THRESHOLD = 0.5;
const LAUNCH_SPEED_THRESHOLD = 2;
const BLINK_TICKS = 5;
const MIN_TICKS_BETWEEN_BLINKS = 90;
const MAX_TICKS_BETWEEN_BLINKS = 300;
const BLINK_SEED = 7;
const DUST_LIFETIME_TICKS = 16;
// Each footfall kicks up one puff at the back foot and a smaller one further behind.
const DUST_PUFFS = [
  { behindPixels: 10, startSize: 5 },
  { behindPixels: 15, startSize: 3 },
];
const DUST_COLORS = ['#c0cbdc', '#8b9bb4'];
const NEUTRAL_FRAME = {};

async function loadPoseEntries(names, pathFor) {
  const entries = await Promise.all(
    names.map(async (name) => [name, await fetch(pathFor(name)).then((response) => response.json())]),
  );
  return Object.fromEntries(entries);
}

// Loads every action's frames file, for the render code to pass back in as poses. poses.victory holds one pose per
// character name.
export async function loadCharacterPoses() {
  const poses = await loadPoseEntries(
    CHARACTER_ACTIONS,
    (action) => `data/images/entities/player/${action}/frames.json`,
  );
  poses.victory = await loadPoseEntries(
    CHARACTERS.map((character) => character.name),
    (name) => `data/images/entities/player/victory/${name}.json`,
  );
  return poses;
}

// The one action that best shows what the player is doing right now. A winner celebrates. Otherwise being hit wins,
// then a launch, then a shove and its swing.
export function pickCharacterAction(player, winnerId = null) {
  if (player.id === winnerId && !player.inWater) return 'victory';
  const beingHit =
    player.isFrozen && (player.pendingKnockbackVelocityX !== 0 || player.pendingKnockbackVelocityY !== 0);
  if (beingHit) return 'hurt';
  if (!player.onGround && Math.abs(player.knockbackVelocityX) > LAUNCH_SPEED_THRESHOLD) return 'launched';
  if (player.shoveCharging) return player.shoveChargeTicks > SHOVE_WINDUP_TICKS ? 'charge' : 'windup';
  if (player.shoveActiveTicksRemaining > 0) return 'swing';
  if (!player.onGround) return player.velocityY < 0 ? 'jump' : 'fall';
  if (Math.abs(player.velocityX) > RUN_SPEED_THRESHOLD) return 'run';
  return 'idle';
}

// chargeProgress runs from 0 at the end of the wind-up to 1 at full charge, and picks the charge's shake stage.
export function poseFrame(pose, ticksInAction, chargeProgress = 0) {
  if (!pose) return NEUTRAL_FRAME;
  let frames = pose.frames;
  if (pose.stages) {
    const stageIndex = Math.min(pose.stages.length - 1, Math.floor(chargeProgress * pose.stages.length));
    frames = pose.stages[stageIndex];
  }
  return frames[Math.floor(ticksInAction / pose.ticksPerFrame) % frames.length];
}

export function chargeProgressOf(player) {
  return Math.max(
    0,
    Math.min(1, (player.shoveChargeTicks - SHOVE_WINDUP_TICKS) / (SHOVE_MAX_CHARGE_TICKS - SHOVE_WINDUP_TICKS)),
  );
}

// Display only: follows each player's action, blinks and run dust once per tick. Game logic never reads it.
export class CharacterAnimations {
  constructor(poses) {
    this.poses = poses;
    this.random = new SeededRandom(BLINK_SEED);
    this.stateByPlayerId = new Map();
    this.dustPuffs = [];
    this.getPlayers = () => [];
    this.getWinnerId = () => null;
  }

  // getWinnerId returns the id of the player to show celebrating, or null.
  attach(getPlayers, getWinnerId = () => null) {
    this.getPlayers = getPlayers;
    this.getWinnerId = getWinnerId;
  }

  poseOf(player, action) {
    if (action === 'victory') return this.poses?.victory?.[player.character.name];
    return this.poses?.[action];
  }

  ticksUntilNextBlink() {
    return (
      MIN_TICKS_BETWEEN_BLINKS + Math.floor(this.random.next() * (MAX_TICKS_BETWEEN_BLINKS - MIN_TICKS_BETWEEN_BLINKS))
    );
  }

  stateFor(playerId) {
    if (!this.stateByPlayerId.has(playerId)) {
      this.stateByPlayerId.set(playerId, {
        action: 'idle',
        ticksInAction: 0,
        ticksUntilBlink: this.ticksUntilNextBlink(),
        blinkTicksRemaining: 0,
      });
    }
    return this.stateByPlayerId.get(playerId);
  }

  update() {
    for (const puff of this.dustPuffs) puff.age++;
    this.dustPuffs = this.dustPuffs.filter((puff) => puff.age < DUST_LIFETIME_TICKS);
    for (const player of this.getPlayers()) {
      const state = this.stateFor(player.id);
      const action = pickCharacterAction(player, this.getWinnerId());
      state.ticksInAction = action === state.action ? state.ticksInAction + 1 : 0;
      state.action = action;
      this.updateBlink(state);
      const frame = this.frameFor(player);
      const pose = this.poseOf(player, action);
      if (frame.dust && pose && state.ticksInAction % pose.ticksPerFrame === 0) this.addDustPuffs(player);
    }
  }

  updateBlink(state) {
    if (state.blinkTicksRemaining > 0) {
      state.blinkTicksRemaining--;
      return;
    }
    state.ticksUntilBlink--;
    if (state.ticksUntilBlink > 0) return;
    state.blinkTicksRemaining = BLINK_TICKS;
    state.ticksUntilBlink = this.ticksUntilNextBlink();
  }

  addDustPuffs(player) {
    for (const { behindPixels, startSize } of DUST_PUFFS) {
      this.dustPuffs.push({
        x: Math.round(player.x + player.width / 2 - player.facing * behindPixels),
        y: Math.round(player.y + player.height),
        directionX: -player.facing,
        startSize,
        age: 0,
      });
    }
  }

  frameFor(player) {
    const state = this.stateFor(player.id);
    return poseFrame(this.poseOf(player, state.action), state.ticksInAction, chargeProgressOf(player));
  }

  // The frame to draw the player with this tick, with eyes closed while blinking.
  poseFor(player) {
    const frame = this.frameFor(player);
    if (this.stateFor(player.id).blinkTicksRemaining > 0) return { ...frame, eyes: 'closed' };
    return frame;
  }

  // Each puff shrinks as it drifts back and up. Puffs 3 pixels or wider lose their corners so they read as round.
  render(context) {
    for (const puff of this.dustPuffs) {
      const size = Math.max(1, puff.startSize - Math.floor((puff.age * puff.startSize) / DUST_LIFETIME_TICKS));
      context.fillStyle = DUST_COLORS[puff.age < DUST_LIFETIME_TICKS / 2 ? 0 : 1];
      const left = puff.x + puff.directionX * Math.floor(puff.age / 3) - Math.floor(size / 2);
      const top = puff.y - Math.floor(puff.age / 4) - size;
      if (size < 3) {
        context.fillRect(left, top, size, size);
        continue;
      }
      context.fillRect(left + 1, top, size - 2, size);
      context.fillRect(left, top + 1, size, size - 2);
    }
  }
}
