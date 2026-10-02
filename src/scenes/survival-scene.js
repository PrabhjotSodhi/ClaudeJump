import { SCREEN_HEIGHT, SCREEN_WIDTH, TILE_SIZE } from '../engine/config.js';
import { BLAST_STRENGTH, blastIsReady, knockBackPlayersInBlast } from '../engine/blast.js';
import { EntityGroups } from '../engine/entity-groups.js';
import { EventEmitter } from '../engine/events.js';
import { SeededRandom } from '../engine/seeded-random.js';
import { wrapAroundScreen } from '../engine/wrap-around-screen.js';
import { DEFAULT_CHARACTER_BY_PLAYER_ID } from '../entities/characters.js';
import { BANANA_SLIP_TICKS } from '../entities/banana.js';
import { BouncePad, BOUNCE_PAD_HEIGHT, BOUNCE_PAD_LAUNCH_VELOCITY, BOUNCE_PAD_WIDTH } from '../entities/bounce-pad.js';
import { Crab, CRAB_HEIGHT, CRAB_WIDTH } from '../entities/crab.js';
import { Platform } from '../entities/platform.js';
import { Player, SHOVE_KNOCKBACK_VELOCITY_X, SHOVE_KNOCKBACK_VELOCITY_Y } from '../entities/player.js';
import { Rocket, ROCKET_HEIGHT, ROCKET_WIDTH } from '../entities/rocket.js';
import { drawArenaBackground } from '../levels/arena-backgrounds.js';
import { blockName } from '../levels/level-loader.js';
import { PLAYERS } from '../levels/versus-arena.js';
import { drawSurvivalHud } from '../ui/hud.js';
import { drawParticles, Particles } from '../vfx/particles.js';
import { CharacterAnimations } from '../vfx/character-animations.js';
import { PlayerEyes } from '../vfx/player-eyes.js';
import { ScreenShake } from '../vfx/screen-shake.js';
import { SeaRipple } from '../vfx/sea-ripple.js';
import { drawSplashes, Splashes, splashTierFor } from '../vfx/splash.js';
import { tapPoint } from '../ui/menu-kit.js';
import { difficultyAt } from './survival-difficulty.js';

const PLAYER_ID = 'red';
const START_FLOOR_Y = SCREEN_HEIGHT - 2 * TILE_SIZE;
const ROW_GAP_MIN_Y = 48;
const ROW_GAP_STEP_Y = 8;
const ROW_GAP_STEP_COUNT = 3;
const RUN_MIN_BLOCKS = 3;
const RUN_MAX_BLOCKS = 6;
const SECOND_RUN_CHANCE = 0.5;
const MAX_REACH_X = 96;
const SPECIAL_KINDS = ['ice', 'bounce', 'fire', 'crumbling'];
export const CRUMBLE_TICKS = 30;
const FIRE_FLICKER_TICKS = 12;
// How far above the player the top of the screen sits once the camera follows.
const CAMERA_LEAD_Y = 180;
// Rows are generated until they reach this far above the top of the screen.
const GENERATE_AHEAD_Y = SCREEN_HEIGHT;
// Rows are dropped once they are this far below the top of the screen.
const KEEP_BELOW_Y = 2 * SCREEN_HEIGHT;
export const SEA_START_BELOW = 48;
export const SEA_GRACE_TICKS = 180;
export const SEA_RISE_PER_TICK = 0.25;
// The sea never trails further than this below the bottom of the screen, so a fast climber still feels it.
export const SEA_MAX_TRAIL_Y = 48;
export const ROCKET_WARNING_TICKS = 60;
// A rocket flies at a height this close to the player's, above or below.
export const ROCKET_MAX_OFFSET_Y = 60;
// Rockets draw from their own stream so they never change how the rows are laid out.
const ROCKET_SEED_OFFSET = 0x5f3759df;
// Crabs draw from their own stream too, so they never change how the rows are laid out.
const CRAB_SEED_OFFSET = 0x2545f491;
// Only a run at least this wide can carry a crab.
const CRAB_MIN_RUN_BLOCKS = 4;
export const CRAB_STOMP_VELOCITY_Y = -8;
export const CRAB_KNOCKBACK_VELOCITY_X = 8;
export const CRAB_KNOCKBACK_VELOCITY_Y = -4;
export const BEST_SCORE_STORAGE_KEY = 'claudejump.survival.best';

// The horizontal gap between two runs, taking the shortest way round the screen edge. 0 when they overlap.
function horizontalGap(runA, runB) {
  let shortestGap = Infinity;
  for (const shift of [-SCREEN_WIDTH, 0, SCREEN_WIDTH]) {
    const gap = Math.max(runB.x + shift - (runA.x + runA.width), runA.x - (runB.x + shift + runB.width), 0);
    shortestGap = Math.min(shortestGap, gap);
  }
  return shortestGap;
}

// True when a jump from a run on the row below can land on some run of this row.
export function isRowReachable(row, rowBelow) {
  return row.runs.some((run) => rowBelow.runs.some((runBelow) => horizontalGap(run, runBelow) <= MAX_REACH_X));
}

export function nextBestScore(best, score) {
  return Math.max(best, score);
}

function loadBestScore() {
  try {
    const stored = Number(globalThis.localStorage.getItem(BEST_SCORE_STORAGE_KEY));
    return Number.isInteger(stored) && stored > 0 ? stored : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(bestScore) {
  try {
    globalThis.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(bestScore));
  } catch {
    // Storage can be missing or blocked. The best score then lasts until the page closes.
  }
}

export class SurvivalScene {
  constructor({ sprites = {}, seed = Date.now() } = {}) {
    this.touchLayout = 'onePlayer';
    this.sprites = sprites;
    this.seed = seed;
    this.events = new EventEmitter();
    this.musicTrackName = 'match';
    this.entityGroups = new EntityGroups();
    this.playerEyes = new PlayerEyes();
    this.playerEyes.attach(this.events, () => this.players);
    this.characterAnimations = new CharacterAnimations(sprites?.characterPoses);
    this.characterAnimations.attach(() => this.players);
    this.particles = new Particles();
    this.particles.attach(this.events, {
      getPlayers: () => this.players,
      getTickCount: () => this.runTicks,
    });
    this.splashes = new Splashes();
    this.splashes.attach(this.events, { getPlayers: () => this.players, getWaterLineY: () => this.waterLineY });
    this.screenShake = new ScreenShake();
    this.screenShake.attach(this.events);
    this.seaRipple = new SeaRipple();
    this.seaRipple.attach(this.events, () => this.players);
    this.bestScore = loadBestScore();
    this.events.on('run-ended', ({ score }) => {
      this.bestScore = nextBestScore(this.bestScore, score);
      saveBestScore(this.bestScore);
    });
    this.backgroundDrawn = false;
    this.jumpHeld = false;
    this.startRun();
  }

  // Screen space, which is where the water shader draws the surface.
  get waterLineY() {
    return this.seaY - this.cameraTopY;
  }

  // Pixels climbed since the run started.
  get score() {
    return this.startPlayerY - this.lowestPlayerY;
  }

  get players() {
    return this.entityGroups.get('players');
  }

  startRun() {
    this.random = new SeededRandom(this.seed);
    this.rocketRandom = new SeededRandom(this.seed + ROCKET_SEED_OFFSET);
    this.crabRandom = new SeededRandom(this.seed + CRAB_SEED_OFFSET);
    this.rocketWarnings = [];
    this.nextRocketTick = difficultyAt(0).rocketIntervalTicks;
    this.entityGroups.clear('rockets');
    this.entityGroups.clear('crabs');
    this.phase = 'playing';
    this.runTicks = 0;
    this.newBestTick = null;
    this.seaY = START_FLOOR_Y + SEA_START_BELOW;
    this.entityGroups.clear('platforms');
    this.entityGroups.clear('bouncePads');
    this.entityGroups.clear('players');
    this.rows = [];
    this.rowCount = 0;
    this.cameraTopY = 0;
    this.addRow({ y: START_FLOOR_Y, runs: [{ x: 0, width: SCREEN_WIDTH }] });
    this.entityGroups.add(
      'players',
      new Player({
        id: PLAYER_ID,
        character: DEFAULT_CHARACTER_BY_PLAYER_ID[PLAYER_ID],
        spawnX: SCREEN_WIDTH / 2,
        spawnY: START_FLOOR_Y,
        facing: 1,
        outlineColor: PLAYERS.find((spawn) => spawn.id === PLAYER_ID).color,
      }),
    );
    this.startPlayerY = Math.round(this.players[0].y);
    this.lowestPlayerY = this.startPlayerY;
    this.generateRows();
  }

  // A run without a kind is stone. Each run keeps its platform, and a bounce run its pad.
  addRow({ y, runs }) {
    for (const run of runs) {
      run.kind ??= 'stone';
      run.platform = new Platform({ x: run.x, y, width: run.width, height: TILE_SIZE, oneWay: true });
      this.entityGroups.add('platforms', run.platform);
      if (run.kind === 'bounce') {
        const x = run.x + (run.width - BOUNCE_PAD_WIDTH) / 2;
        run.pad = new BouncePad({ x, y: y - BOUNCE_PAD_HEIGHT, lifetimeTicks: Infinity });
        this.entityGroups.add('bouncePads', run.pad);
      }
    }
    this.rows.push({ index: this.rowCount++, y, runs });
  }

  randomInteger(minimum, maximum) {
    return minimum + Math.floor(this.random.next() * (maximum - minimum + 1));
  }

  randomRun(x) {
    return { x, width: this.randomInteger(RUN_MIN_BLOCKS, RUN_MAX_BLOCKS) * TILE_SIZE };
  }

  // The first run always sits within reach of a run on the row below, so every row can be climbed to.
  // A second run lands anywhere the first one leaves room for.
  generateRow(rowBelow) {
    const gapY = ROW_GAP_MIN_Y + this.randomInteger(0, ROW_GAP_STEP_COUNT - 1) * ROW_GAP_STEP_Y;
    const { specialPlatformChance } = difficultyAt(START_FLOOR_Y - (rowBelow.y - gapY));
    const anchor = rowBelow.runs[this.randomInteger(0, rowBelow.runs.length - 1)];
    const first = this.randomRun(0);
    const firstBlock = Math.ceil((anchor.x - MAX_REACH_X - first.width) / TILE_SIZE);
    const lastBlock = (anchor.x + anchor.width + MAX_REACH_X) / TILE_SIZE;
    first.x = Math.max(0, Math.min(SCREEN_WIDTH - first.width, this.randomInteger(firstBlock, lastBlock) * TILE_SIZE));
    const runs = [first];

    if (this.random.next() < SECOND_RUN_CHANCE) {
      const second = this.randomRun(0);
      const leftRoom = first.x - TILE_SIZE - second.width;
      const rightStart = first.x + first.width + TILE_SIZE;
      const rightRoom = SCREEN_WIDTH - second.width - rightStart;
      if (leftRoom >= 0 || rightRoom >= 0) {
        const useRight = rightRoom >= 0 && (leftRoom < 0 || this.random.next() < 0.5);
        second.x = useRight
          ? rightStart + this.randomInteger(0, rightRoom / TILE_SIZE) * TILE_SIZE
          : this.randomInteger(0, leftRoom / TILE_SIZE) * TILE_SIZE;
        runs.push(second);
      }
    }
    // The first run is the one placed within reach, so it is never fire: a fire run throws the player off and
    // would wall the climb.
    runs.forEach((run, index) => {
      if (this.random.next() >= specialPlatformChance) return;
      const kinds = index === 0 ? SPECIAL_KINDS.filter((kind) => kind !== 'fire') : SPECIAL_KINDS;
      run.kind = kinds[this.randomInteger(0, kinds.length - 1)];
    });
    return { y: rowBelow.y - gapY, runs: runs.sort((runA, runB) => runA.x - runB.x) };
  }

  generateRows() {
    while (this.rows.at(-1).y > this.cameraTopY - GENERATE_AHEAD_Y) {
      const row = this.generateRow(this.rows.at(-1));
      this.addRow(row);
      this.spawnCrabs(row);
    }
  }

  spawnCrabs(row) {
    const { crabChance } = difficultyAt(START_FLOOR_Y - row.y);
    for (const run of row.runs) {
      if (run.width < CRAB_MIN_RUN_BLOCKS * TILE_SIZE || this.crabRandom.next() >= crabChance) continue;
      const maxX = run.x + run.width - CRAB_WIDTH;
      const x = run.x + Math.floor(this.crabRandom.next() * (maxX - run.x + 1));
      const direction = this.crabRandom.next() < 0.5 ? -1 : 1;
      run.crab = new Crab({ x, y: row.y - CRAB_HEIGHT, minX: run.x, maxX, direction });
      this.entityGroups.add('crabs', run.crab);
    }
  }

  dropRowsBelowCamera() {
    const survivingRows = this.rows.filter((row) => row.y <= this.cameraTopY + KEEP_BELOW_Y);
    if (survivingRows.length === this.rows.length) return;
    for (const row of this.rows) {
      if (survivingRows.includes(row)) continue;
      for (const run of row.runs) this.removeRun(run);
    }
    this.rows = survivingRows;
  }

  removeRun(run) {
    this.entityGroups.remove('platforms', run.platform);
    if (run.pad) this.entityGroups.remove('bouncePads', run.pad);
    if (run.crab) this.entityGroups.remove('crabs', run.crab);
  }

  runUnderfoot(player) {
    const feetY = player.y + player.height;
    for (const row of this.rows) {
      if (row.y !== feetY) continue;
      const run = row.runs.find(
        (candidate) =>
          !candidate.broken && player.x < candidate.x + candidate.width && player.x + player.width > candidate.x,
      );
      if (run) return run;
    }
    return null;
  }

  // A landing on ice slips, on fire burns, and on crumbling starts the countdown.
  applyLanding(player) {
    const run = this.runUnderfoot(player);
    if (run?.kind === 'ice') player.makeSlip(BANANA_SLIP_TICKS);
    if (run?.kind === 'crumbling' && run.crumbleTicksRemaining === undefined) run.crumbleTicksRemaining = CRUMBLE_TICKS;
    if (run?.kind === 'fire') {
      const backDirection = -(Math.sign(player.velocityX + player.knockbackVelocityX) || player.facing);
      player.applyKnockback(SHOVE_KNOCKBACK_VELOCITY_X * backDirection, SHOVE_KNOCKBACK_VELOCITY_Y);
      this.events.emit('player-burned', { playerId: player.id });
    }
  }

  launchFromBouncePads(player) {
    for (const pad of this.entityGroups.get('bouncePads')) {
      if (pad.isLandedOnBy(player)) player.launchUpward(BOUNCE_PAD_LAUNCH_VELOCITY);
    }
  }

  // Runs before the landing check, so the tick a countdown starts on is not counted.
  crumbleRuns() {
    for (const row of this.rows) {
      for (const run of row.runs) {
        if (run.crumbleTicksRemaining === undefined || run.broken) continue;
        run.crumbleTicksRemaining--;
        if (run.crumbleTicksRemaining > 0) continue;
        run.broken = true;
        this.removeRun(run);
        for (let block = 0; block < run.width / TILE_SIZE; block++) {
          this.events.emit('block-broken', { x: run.x + block * TILE_SIZE, y: row.y, size: TILE_SIZE });
        }
      }
    }
  }

  // A stomp is the player's feet crossing the crab's top this tick. Any other touch pinches, unless a hit is
  // already knocking the player away.
  updateCrabs(player) {
    for (const crab of this.entityGroups.get('crabs')) {
      crab.update();
      if (player.inWater || player.isFrozen || !player.overlaps(crab)) continue;
      const feetY = player.y + player.height;
      if (player.previousY + player.height <= crab.y && feetY >= crab.y) {
        player.launchUpward(CRAB_STOMP_VELOCITY_Y);
        this.removeCrab(crab);
        this.events.emit('crab-stomped', { x: crab.x + crab.width / 2, y: crab.y });
      } else if (player.knockbackVelocityX === 0) {
        const awayDirection = Math.sign(player.x + player.width / 2 - (crab.x + crab.width / 2)) || -player.facing;
        player.freeze('light', CRAB_KNOCKBACK_VELOCITY_X * awayDirection, CRAB_KNOCKBACK_VELOCITY_Y);
        crab.freeze('light');
        this.events.emit('player-pinched', {
          playerId: player.id,
          directionX: awayDirection,
          directionY: 0,
          strength: 'light',
        });
      }
    }
  }

  removeCrab(crab) {
    this.entityGroups.remove('crabs', crab);
    for (const row of this.rows) {
      for (const run of row.runs) if (run.crab === crab) delete run.crab;
    }
  }

  // Every rocket is announced ROCKET_WARNING_TICKS before it spawns, and spawns only from that warning.
  updateRockets(player) {
    if (this.runTicks >= this.nextRocketTick) this.scheduleRocket(player);

    for (const warning of this.rocketWarnings.filter((candidate) => candidate.spawnTick <= this.runTicks)) {
      const facing = warning.side === 'left' ? 1 : -1;
      const x = warning.side === 'left' ? -ROCKET_WIDTH : SCREEN_WIDTH;
      this.entityGroups.add('rockets', new Rocket({ x, y: warning.y, facing, shooterId: null }));
    }
    this.rocketWarnings = this.rocketWarnings.filter((warning) => warning.spawnTick > this.runTicks);

    // Survival rockets fly through blocks, so they get no platforms to hit.
    for (const rocket of this.entityGroups.get('rockets')) {
      rocket.update(this.players, []);
      if (rocket.exploded) {
        if (!blastIsReady(rocket, this.players, rocket.shooterId)) continue;
        const blastCenterX = rocket.x + rocket.width / 2;
        const blastCenterY = rocket.y + rocket.height / 2;
        const playerIds = knockBackPlayersInBlast(this.players, blastCenterX, blastCenterY);
        this.events.emit('rocket-exploded', { x: blastCenterX, y: blastCenterY, playerIds, strength: BLAST_STRENGTH });
        this.entityGroups.remove('rockets', rocket);
      } else if (rocket.x > SCREEN_WIDTH || rocket.x + rocket.width < 0) {
        this.entityGroups.remove('rockets', rocket);
      }
    }
  }

  scheduleRocket(player) {
    const side = this.rocketRandom.next() < 0.5 ? 'left' : 'right';
    const offsetY = this.rocketRandom.next() * (2 * ROCKET_MAX_OFFSET_Y + 1);
    const y = Math.round(player.y + player.height / 2 - ROCKET_HEIGHT / 2) + Math.floor(offsetY) - ROCKET_MAX_OFFSET_Y;
    this.nextRocketTick = this.runTicks + difficultyAt(this.score).rocketIntervalTicks;
    this.rocketWarnings.push({ side, y, startTick: this.runTicks, spawnTick: this.runTicks + ROCKET_WARNING_TICKS });
  }

  update(inputByPlayerId) {
    const jumpPressed = inputByPlayerId[PLAYER_ID]?.jump ?? false;
    const freshJump = jumpPressed && !this.jumpHeld;
    this.jumpHeld = jumpPressed;
    this.seaRipple.update();
    this.particles.update();
    this.splashes.update();
    this.screenShake.update();

    if (this.phase === 'over') {
      if (freshJump || tapPoint(inputByPlayerId)) {
        this.seed++;
        this.startRun();
      }
      return;
    }

    const player = this.players[0];
    this.crumbleRuns();
    player.update(inputByPlayerId[PLAYER_ID] ?? null, this.entityGroups.get('platforms'));
    if (player.ticksSinceLanding === 0) this.applyLanding(player);
    this.launchFromBouncePads(player);
    this.updateCrabs(player);
    this.updateRockets(player);
    if (player.ticksSinceJump === 0) {
      this.events.emit('player-jumped', {
        playerId: player.id,
        x: player.x + player.width / 2,
        y: player.y + player.height,
      });
    }
    if (wrapAroundScreen(player)) this.events.emit('player-wrapped', { playerId: player.id, x: player.x, y: player.y });
    this.playerEyes.update();
    this.characterAnimations.update();

    this.cameraTopY = Math.min(this.cameraTopY, Math.round(player.y) - CAMERA_LEAD_Y);
    this.generateRows();
    this.dropRowsBelowCamera();

    this.lowestPlayerY = Math.min(this.lowestPlayerY, Math.round(player.y));
    if (this.newBestTick === null && this.bestScore > 0 && this.score > this.bestScore) {
      this.newBestTick = this.runTicks;
      this.events.emit('new-best', { score: this.score });
    }
    this.runTicks++;
    if (this.runTicks > SEA_GRACE_TICKS) this.seaY -= SEA_RISE_PER_TICK;
    this.seaY = Math.min(this.seaY, this.cameraTopY + SCREEN_HEIGHT + SEA_MAX_TRAIL_Y);
    if (player.y + player.height >= this.seaY) {
      this.phase = 'over';
      const fallSpeed = player.velocityY;
      this.events.emit('player-fell-in-water', {
        playerId: player.id,
        fallSpeed,
        splashTier: splashTierFor(fallSpeed),
      });
      this.events.emit('run-ended', { score: this.score });
    }
  }

  // stoneBlocksByKind holds one sprite set per look, built once at load. Bounce runs are stone.
  blockSpritesFor(run) {
    const { stoneBlocks, stoneBlocksByKind = {} } = this.sprites;
    if (run.kind === 'fire') {
      const flickerFrame = Math.floor(this.runTicks / FIRE_FLICKER_TICKS) % 2;
      return stoneBlocksByKind[flickerFrame ? 'fire-flicker' : 'fire'] ?? stoneBlocks;
    }
    return stoneBlocksByKind[run.kind] ?? stoneBlocks;
  }

  render(renderer) {
    if (!this.backgroundDrawn) {
      renderer.updateBackground((context) => drawArenaBackground(context, 'rooftops'));
      this.backgroundDrawn = true;
    }

    renderer.shakeOffset = this.screenShake.offset;
    renderer.seaRippleBytes = this.seaRipple.toBytes();
    renderer.clearGameLayer();
    renderer.clearUiLayer();
    const context = renderer.gameContext;
    context.save();
    context.translate(0, -this.cameraTopY);
    for (const row of this.rows) {
      for (const run of row.runs) {
        if (run.broken) continue;
        const blocks = this.blockSpritesFor(run);
        for (let block = 0; block < run.width / TILE_SIZE; block++) {
          const column = run.x / TILE_SIZE + block;
          context.drawImage(blocks[blockName('small', column, row.index)], run.x + block * TILE_SIZE, row.y);
        }
        run.pad?.render(context);
      }
    }
    this.entityGroups.get('crabs').forEach((crab) => crab.render(context));
    this.characterAnimations.render(context);
    const appearance = {
      sprites: this.sprites,
      playerEyes: this.playerEyes,
      characterAnimations: this.characterAnimations,
    };
    this.entityGroups.get('players').forEach((player) => player.render(context, appearance));
    this.entityGroups.get('rockets').forEach((rocket) => rocket.render(context));
    drawSplashes(context, this);
    drawParticles(context, this);
    context.restore();
    drawSurvivalHud(renderer.uiContext, this);
  }
}
