import { crateCardFor, GOLDEN_PICKUP_USES, PICKUP_USES } from '../cards/card-definitions.js';
import {
  CALLOUT_CAUSE_TICKS,
  GOLDEN_CRATE_AFTER_TICKS,
  KNOCKOUT_SLOWMO_STEP_INTERVAL,
  KNOCKOUT_SLOWMO_TICKS,
  MAGNET_PULL_SPEED,
  MAGNET_STOP_DISTANCE,
  MODIFIER_EVERY_N_ROUNDS,
  MODIFIER_PICK_TICKS,
  ROUND_COUNTDOWN_BEAT_TICKS,
  ROUND_COUNTDOWN_TICKS,
  ROUND_GO_TICKS,
  ROUND_MODIFIERS,
  SCREEN_WIDTH,
  SHOVE_CHARGE_REPORT_INTERVAL_TICKS,
  SHOVE_CLASH_BOUNCE_VELOCITY_X,
  SHOVE_CLASH_CHARGE_MARGIN,
  SHOVE_CLASH_WIN_KNOCKBACK_MULTIPLIER,
  SHOVE_MAX_CHARGE_TICKS,
  SHOVE_WINDUP_TICKS,
  TICK_RATE,
  TILE_SIZE,
  TIMER_URGENT_SECONDS,
  TIME_LOW_SECONDS,
} from '../engine/config.js';
import {
  BLAST_STRENGTH,
  blastIsReady,
  blastReaches,
  crateSlideVelocity,
  knockBackPlayersInBlast,
} from '../engine/blast.js';
import { EntityGroups } from '../engine/entity-groups.js';
import { EventEmitter } from '../engine/events.js';
import { SeededRandom } from '../engine/seeded-random.js';
import { wrapAroundScreen } from '../engine/wrap-around-screen.js';
import { Banana, BANANA_WIDTH, BANANA_HEIGHT, BANANA_SLIP_TICKS } from '../entities/banana.js';
import { BananaDrop } from '../entities/banana-drop.js';
import { Bomb, BOMB_WIDTH, BOMB_HEIGHT } from '../entities/bomb.js';
import {
  BouncePad,
  BOUNCE_PAD_WIDTH,
  BOUNCE_PAD_HEIGHT,
  BOUNCE_PAD_LAUNCH_VELOCITY,
  BOUNCE_PAD_FLING_VELOCITY_X,
  BOUNCE_PAD_FLING_VELOCITY_Y,
} from '../entities/bounce-pad.js';
import { IceShot, ICE_SHOT_WIDTH, ICE_SHOT_HEIGHT } from '../entities/ice-shot.js';
import { DEFAULT_JOINED_PLAYERS } from '../entities/characters.js';
import { BLAST_SLIDE_SPEED, Crate, CRATE_WIDTH, CRATE_HEIGHT, CRATE_WARNING_TICKS } from '../entities/crate.js';
import { Platform } from '../entities/platform.js';
import { Player } from '../entities/player.js';
import { Rocket, ROCKET_WIDTH, ROCKET_HEIGHT } from '../entities/rocket.js';
import { knockBackShoveTarget, resolveShoveHit, resolveShoveHitOnCrate } from '../entities/shove.js';
import { HoldTheHill } from './hold-the-hill.js';
import { PassTheBomb } from './pass-the-bomb.js';
import { drawArenaBackground } from '../levels/arena-backgrounds.js';
import { createHazards } from '../levels/level-hazards.js';
import { solidRuns } from '../levels/level-loader.js';
import { PLAYERS } from '../levels/versus-arena.js';
import { drawHeldCardIcons } from '../ui/held-card-icons.js';
import { Callouts } from '../ui/callouts.js';
import { drawHud } from '../ui/hud.js';
import { drawModifierPick } from '../ui/modifier-pick.js';
import { drawRoundIntro, isMatchPoint } from '../ui/round-intro.js';
import { MatchStats } from '../ui/match-stats.js';
import { drawPlayerTags } from '../ui/player-tags.js';
import { WinPips } from '../ui/win-pips.js';
import { ClashSparks, drawClashSparks } from '../vfx/clash-sparks.js';
import { knockoutZoom } from '../vfx/knockout-zoom.js';
import { drawHeldBomb } from '../vfx/held-bomb.js';
import { drawHillZone } from '../vfx/hill-zone.js';
import { drawMagnetField } from '../vfx/magnet-field.js';
import { CharacterAnimations } from '../vfx/character-animations.js';
import { Confetti } from '../vfx/confetti.js';
import { CrateOpenings } from '../vfx/crate-openings.js';
import { PlayerEyes } from '../vfx/player-eyes.js';
import { drawParticles, HARD_LANDING_SPEED, Particles } from '../vfx/particles.js';
import { SeaRipple } from '../vfx/sea-ripple.js';
import { drawSplashes, Splashes, splashTierFor } from '../vfx/splash.js';
import { ScreenShake } from '../vfx/screen-shake.js';
import { drawWrapPuffs, WrapPuffTracker } from '../vfx/wrap-puff.js';

// The round rules each party mode adds. Knockout has none.
const MODE_RULES = { hill: HoldTheHill, bomb: PassTheBomb };

const WINS_NEEDED = 5;
const POINT_PAUSE_TICKS = 90;
const RESTART_DELAY_TICKS = 60;
// How far one player's feet may sit above the other's head and still count as jumping over, not landing on them.
const DASH_HEAD_CLEARANCE = 8;
// Players knocked apart to a gap this small still count as the same contact, so the hit does not refire every tick.
const DASH_CONTACT_GAP = 6;
const DASH_KNOCKBACK_VELOCITY_X = 8;
// Smaller than the blast radius that knocks players back, so a blast knocks players far but only bites a chunk out of the arena.
const BLOCK_BLAST_RADIUS = 24;
// A dashing player stopped by a wall only touches it, so the body reaches this far sideways to break it.
const DASH_BREAK_REACH = 1;

function rectanglesOverlap(first, second) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function blockOverlaps(block, rectangle) {
  return (
    block.x < rectangle.x + rectangle.width &&
    block.x + block.size > rectangle.x &&
    block.y < rectangle.y + rectangle.height &&
    block.y + block.size > rectangle.y
  );
}

function blockIsInBlast(block, blastCenterX, blastCenterY) {
  const nearestX = Math.max(block.x, Math.min(blastCenterX, block.x + block.size));
  const nearestY = Math.max(block.y, Math.min(blastCenterY, block.y + block.size));
  const distanceX = nearestX - blastCenterX;
  const distanceY = nearestY - blastCenterY;
  return Math.sqrt(distanceX * distanceX + distanceY * distanceY) <= BLOCK_BLAST_RADIUS;
}

const SUDDEN_DEATH_ROUND_TICKS = 1800; // 30 seconds; the round timer and the warning start point
const SUDDEN_DEATH_WARNING_TICKS = 120; // 2 seconds of flashing markers before the sea rises
const SUDDEN_DEATH_RISE_TICKS = 1200; // 20 seconds for the sea to reach the level's sudden death line

// A crate lands this many ticks after the previous one was taken (or lost to the rising sea).
// The crate itself spends the last CRATE_WARNING_TICKS of that window showing its warning marker.
const CRATE_RESPAWN_TICKS = 180;
const CRATE_SPAWN_DELAY_TICKS = CRATE_RESPAWN_TICKS - CRATE_WARNING_TICKS;

export class VersusScene {
  constructor({
    level,
    startInFightPhase = false,
    seed = Date.now(),
    players = DEFAULT_JOINED_PLAYERS,
    sprites = {},
    levels = [],
    heat = false,
    mode = 'knockout',
  } = {}) {
    // The joined players, each { id, character }, in seat order. Every level has a spawn for each id.
    this.joinedPlayers = players;
    this.characterByPlayerId = Object.fromEntries(players.map(({ id, character }) => [id, character]));
    this.sprites = sprites;
    this.levels = levels;
    this.heatEnabled = heat;
    // One of MATCH_MODES. Knockout is last standing with a rising sea; a party mode brings its own round rules.
    this.mode = mode;
    const ModeRules = MODE_RULES[mode];
    this.modeRules = ModeRules ? new ModeRules() : null;
    this.events = new EventEmitter();
    this.random = new SeededRandom(seed);
    this.entityGroups = new EntityGroups();
    this.level = level;
    this.suddenDeathRisePerTick = (level.waterLineY - level.suddenDeathLineY) / SUDDEN_DEATH_RISE_TICKS;

    this.waterLineY = level.waterLineY;
    this.backgroundDrawn = false;
    this.winsNeeded = WINS_NEEDED;
    this.wins = {};
    for (const { id } of players) this.wins[id] = 0;
    this.skipNextReadyPhase = startInFightPhase;
    // The last rocket or banana to hit each player, { cause, tick }, so a fall can be named for what caused it.
    this.recentCauseByPlayerId = new Map();
    this.dashHitPairIds = new Set();
    // Which opponents each shover has already hit this shove, so one shove lands at most one hit
    // per opponent even while its hit zone stays active for several ticks.
    this.shoveHitIdsByShoverId = new Map();
    this.shoveClashPairIds = new Set();
    this.roundNumber = 0;
    this.activeModifierId = null;
    this.pendingModifierId = null;
    this.modifierPickerId = null;
    this.modifierOptionIds = [];
    this.modifierHighlight = 0;
    this.modifierJumpHeld = false;
    this.ticksUntilBananaDrop = 0;
    this.goldenCrateSpawned = false;
    // Elapsed scene ticks, kept across rounds. Display-only effects (like the held card flash)
    // time themselves off it instead of off rendered frames.
    this.tickCount = 0;
    // Display-only, and created here for the same reason as the stats: it must never miss an event.
    this.screenShake = new ScreenShake();
    this.screenShake.attach(this.events);
    this.seaRipple = new SeaRipple();
    this.seaRipple.attach(this.events, () => this.players);
    this.seaRipple.attachCrates(this.events);
    this.particles = new Particles();
    this.particles.attach(this.events, {
      getPlayers: () => this.players,
      getWaterLineY: () => this.waterLineY,
      getTickCount: () => this.tickCount,
    });
    this.splashes = new Splashes();
    this.splashes.attach(this.events, { getPlayers: () => this.players, getWaterLineY: () => this.waterLineY });
    this.splashes.attachCrates(this.events);
    // Display data for the results screen, counted only from events. Created here (rather than
    // lazily on first render) so it never misses an event: dev mode can run a whole match through
    // step() with no render call in between. Game logic never reads it, only the HUD does.
    this.callouts = new Callouts();
    this.callouts.attach(this.events, {
      getPlayers: () => this.players,
      getTickCount: () => this.tickCount,
    });
    this.matchStats = new MatchStats(Object.keys(this.wins));
    this.matchStats.attach(this.events, () => this.phase === 'fight');
    this.winPips = new WinPips();
    this.winPips.attach(this.events, () => this.tickCount);
    // Display-only, created here for the same reason: it must never miss a player-wrapped event.
    this.playerEyes = new PlayerEyes();
    this.playerEyes.attach(this.events, () => this.players);
    this.characterAnimations = new CharacterAnimations(sprites?.characterPoses);
    this.characterAnimations.attach(
      () => this.players,
      () => (this.phase === 'point' || this.phase === 'match' ? this.winnerId : null),
    );
    this.confetti = new Confetti();
    this.confetti.attach(this.events, () => this.players);
    this.crateOpenings = new CrateOpenings();
    this.crateOpenings.attach(this.events, () => this.players);
    this.clashSparks = new ClashSparks();
    this.clashSparks.attach(
      this.events,
      () => this.players,
      () => this.tickCount,
    );
    this.wrapPuffTracker = new WrapPuffTracker();
    this.wrapPuffTracker.attach(
      this.events,
      () => this.players,
      () => this.tickCount,
    );
    this.startRound();
  }

  get players() {
    return this.entityGroups.get('players');
  }

  get suddenDeathCountdownTicks() {
    return Math.max(0, (this.modeRules?.roundTicks ?? SUDDEN_DEATH_ROUND_TICKS) - this.fightTicks);
  }

  get activeModifier() {
    return ROUND_MODIFIERS[this.activeModifierId] ?? {};
  }

  startRound() {
    this.roundNumber++;
    this.activeModifierId = this.pendingModifierId;
    this.pendingModifierId = null;
    this.ticksUntilBananaDrop = this.activeModifier.bananaRainIntervalTicks ?? 0;
    // Crates and bounce pads must be cleared (and so, on the first round, first inserted into
    // the entity groups) before players, so they render underneath the players standing on them.
    this.entityGroups.clear('crates');
    this.entityGroups.clear('bouncePads');
    this.entityGroups.clear('bananaDrops');
    this.entityGroups.clear('bananas');
    this.entityGroups.clear('players');
    this.entityGroups.clear('rockets');
    this.entityGroups.clear('bombs');
    this.entityGroups.clear('iceShots');
    this.entityGroups.clear('hazards');
    for (const hazard of createHazards(this.level.hazards, { level: this.level, random: this.random }))
      this.entityGroups.add('hazards', hazard);
    this.restoreBlocks();
    for (const { x, y } of this.level.bouncePads) {
      this.entityGroups.add('bouncePads', new BouncePad({ x, y, lifetimeTicks: Infinity }));
    }
    for (const { id, character } of this.joinedPlayers)
      this.entityGroups.add('players', this.createPlayer(id, character));
    this.ticksUntilCrateSpawn = this.crateSpawnDelayTicks();
    this.goldenCrateSpawned = false;
    if (this.skipNextReadyPhase) {
      this.phase = 'fight';
      this.ticksRemaining = ROUND_GO_TICKS;
      this.skipNextReadyPhase = false;
    } else {
      this.phase = 'ready';
      this.ticksRemaining = ROUND_COUNTDOWN_TICKS;
    }
    this.recentCauseByPlayerId.clear();
    this.winnerId = null;
    this.knockoutTicks = 0;
    this.knockoutFocusPlayerId = null;
    this.dashHitPairIds.clear();
    this.shoveHitIdsByShoverId.clear();
    this.shoveClashPairIds.clear();
    this.waterLineY = this.level.waterLineY;
    this.fightTicks = 0;
    this.suddenDeathPhase = 'none';
    this.modeRules?.startRound(this);
    this.events.emit('round-started', {});
    if (isMatchPoint(this.wins, this.winsNeeded)) this.events.emit('match-point', {});
    if (this.phase === 'ready')
      this.events.emit('countdown-beat', { count: ROUND_COUNTDOWN_TICKS / ROUND_COUNTDOWN_BEAT_TICKS });
  }

  createPlayer(id, character) {
    const { x, y, facing } = this.level.spawns.find((spawn) => spawn.id === id);
    return new Player({
      id,
      character,
      spawnX: x,
      spawnY: y,
      facing,
      heatEnabled: this.heatEnabled,
      gravityMultiplier: this.activeModifier.gravityMultiplier,
      groundAccelerationMultiplier: this.activeModifier.groundAccelerationMultiplier,
      outlineColor: PLAYERS.find((spawn) => spawn.id === id).color,
    });
  }

  // A fresh player at their own spawn, in the same seat so every loop over players keeps its order.
  respawnPlayer(player) {
    const players = this.players;
    const respawned = this.createPlayer(player.id, player.character);
    players[players.indexOf(player)] = respawned;
    this.events.emit('player-respawned', {
      playerId: player.id,
      x: respawned.x + respawned.width / 2,
      y: respawned.y + respawned.height,
    });
  }

  startNextRound() {
    if ((this.roundNumber + 1) % MODIFIER_EVERY_N_ROUNDS === 0) this.beginModifierPick();
    else this.startRound();
  }

  beginModifierPick() {
    const modifierIds = Object.keys(ROUND_MODIFIERS);
    const [firstOptionId] = modifierIds.splice(Math.floor(this.random.next() * modifierIds.length), 1);
    const secondOptionId = modifierIds[Math.floor(this.random.next() * modifierIds.length)];
    this.modifierOptionIds = [firstOptionId, secondOptionId];
    this.modifierPickerId = this.joinedPlayers.reduce((trailing, candidate) =>
      this.wins[candidate.id] < this.wins[trailing.id] ? candidate : trailing,
    ).id;
    this.modifierHighlight = 0;
    // Starts true so a jump key still held from the last round does not confirm a pick.
    this.modifierJumpHeld = true;
    this.phase = 'modifier';
    this.ticksRemaining = MODIFIER_PICK_TICKS;
    this.events.emit('modifier-pick-started', { playerId: this.modifierPickerId, optionIds: this.modifierOptionIds });
  }

  // Only the picking player's input counts.
  updateModifierPick(inputByPlayerId) {
    const input = inputByPlayerId?.[this.modifierPickerId];
    if (input?.left && !input.right) this.modifierHighlight = 0;
    if (input?.right && !input.left) this.modifierHighlight = 1;
    const jumpPressed = Boolean(input?.jump);
    const confirmed = jumpPressed && !this.modifierJumpHeld;
    this.modifierJumpHeld = jumpPressed;
    if (!confirmed && this.ticksRemaining > 0) return;

    this.pendingModifierId = this.modifierOptionIds[this.modifierHighlight];
    this.events.emit('modifier-picked', { playerId: this.modifierPickerId, modifierId: this.pendingModifierId });
    this.startRound();
  }

  crateSpawnDelayTicks() {
    return Math.round(CRATE_SPAWN_DELAY_TICKS * (this.activeModifier.crateDelayMultiplier ?? 1));
  }

  // A banana falls from above the screen onto a random open platform, but only after its marker has flashed there.
  updateBananaRain() {
    for (const drop of this.entityGroups.get('bananaDrops')) {
      drop.update();
      if (drop.ticksRemaining > 0) continue;

      this.entityGroups.add('bananas', new Banana({ x: drop.x, y: -BANANA_HEIGHT, dropperId: null }));
      this.entityGroups.remove('bananaDrops', drop);
    }
    if (!this.activeModifier.bananaRainIntervalTicks) return;

    this.ticksUntilBananaDrop--;
    if (this.ticksUntilBananaDrop > 0) return;

    const openTops = this.openTops.filter((openTop) => openTop.y < this.waterLineY);
    if (openTops.length === 0) return;

    const openTop = openTops[Math.floor(this.random.next() * openTops.length)];
    const x = openTop.x + this.random.next() * (openTop.width - BANANA_WIDTH);
    this.entityGroups.add('bananaDrops', new BananaDrop({ x, landingY: openTop.y }));
    this.ticksUntilBananaDrop = this.activeModifier.bananaRainIntervalTicks;
  }

  // Blocks broken in a round are gone until the next one. The level itself is never changed, so the next round
  // and the thumbnails still see every block.
  restoreBlocks() {
    this.blocks = [...this.level.blocks];
    this.solidCells = this.level.solidCells.map((row) => [...row]);
    this.brokenTiles = new Set();
    this.rebuildSolids();
  }

  removeSolidCell(column, row) {
    this.solidCells[row][column] = false;
    this.rebuildSolids();
  }

  rebuildSolids() {
    const { platforms, openTops } = solidRuns(this.solidCells);
    this.entityGroups.clear('platforms');
    for (const layout of platforms) this.entityGroups.add('platforms', new Platform(layout));
    this.openTops = openTops;
  }

  breakBlocksWhere(touchesBlock) {
    const brokenBlocks = this.blocks.filter(touchesBlock);
    if (brokenBlocks.length === 0) return;

    this.blocks = this.blocks.filter((block) => !brokenBlocks.includes(block));
    for (const block of brokenBlocks) {
      const firstColumn = block.x / TILE_SIZE;
      const firstRow = block.y / TILE_SIZE;
      for (let row = firstRow; row < firstRow + block.size / TILE_SIZE; row++) {
        for (let column = firstColumn; column < firstColumn + block.size / TILE_SIZE; column++) {
          this.solidCells[row][column] = false;
        }
      }
      this.brokenTiles.add(block.tile);
      this.events.emit('block-broken', { x: block.x, y: block.y, size: block.size });
    }
    this.rebuildSolids();
    this.dropUnsupportedBouncePads(brokenBlocks);
  }

  // A pad that stood on a broken block goes with it, unless another solid cell still holds it up.
  dropUnsupportedBouncePads(brokenBlocks) {
    for (const bouncePad of this.entityGroups.get('bouncePads')) {
      const padBottomY = bouncePad.y + bouncePad.height;
      const stoodOnBrokenBlock = brokenBlocks.some(
        (block) =>
          block.y === padBottomY && block.x < bouncePad.x + bouncePad.width && block.x + block.size > bouncePad.x,
      );
      if (!stoodOnBrokenBlock) continue;
      const row = this.solidCells[padBottomY / TILE_SIZE] ?? [];
      const firstColumn = Math.floor(bouncePad.x / TILE_SIZE);
      const lastColumn = Math.floor((bouncePad.x + bouncePad.width - 1) / TILE_SIZE);
      let supported = false;
      for (let column = firstColumn; column <= lastColumn; column++) if (row[column]) supported = true;
      if (!supported) this.entityGroups.remove('bouncePads', bouncePad);
    }
  }

  update(inputByPlayerId) {
    this.tickCount++;
    this.ticksRemaining--;
    if (this.knockoutTicks > 0) this.knockoutTicks++;
    const worldSteps = this.phase !== 'knockout' || this.knockoutTicks % KNOCKOUT_SLOWMO_STEP_INTERVAL === 0;
    if (worldSteps) {
      this.screenShake.update();
      this.seaRipple.update();
      this.particles.update();
      this.splashes.update();
      this.playerEyes.update();
      this.characterAnimations.update();
      this.confetti.update();
      this.crateOpenings.update();
    }
    switch (this.phase) {
      case 'ready':
        if (this.ticksRemaining <= 0) {
          this.phase = 'fight';
          this.ticksRemaining = ROUND_GO_TICKS;
          this.events.emit('countdown-beat', { count: 0 });
        } else if (this.ticksRemaining % ROUND_COUNTDOWN_BEAT_TICKS === 0) {
          this.events.emit('countdown-beat', { count: this.ticksRemaining / ROUND_COUNTDOWN_BEAT_TICKS });
        }
        break;
      case 'fight':
        this.fightTicks++;
        this.updateSuddenDeath();
        this.updatePlayers(inputByPlayerId);
        this.updateHazards();
        this.updateRockets();
        this.updateBombs();
        this.updateIceShots();
        this.updateMagnets();
        this.updateBouncePads();
        this.updateBananaRain();
        this.updateBananas();
        this.updateCrates();
        this.modeRules?.update(this);
        this.checkRoundEnd();
        break;
      case 'knockout':
        if (worldSteps) {
          this.updatePlayers(null);
          this.updateRockets();
          this.updateBombs();
          this.updateIceShots();
        }
        if (this.ticksRemaining <= 0) this.endRound();
        break;
      case 'point':
        this.updatePlayers(null);
        this.updateRockets();
        this.updateBombs();
        this.updateIceShots();
        if (this.ticksRemaining <= 0) this.startNextRound();
        break;
      case 'modifier':
        this.updateModifierPick(inputByPlayerId);
        break;
      case 'match':
        this.updatePlayers(null);
        this.updateRockets();
        this.updateBombs();
        this.updateIceShots();
        break;
    }
  }

  updateSuddenDeath() {
    const countdownTicks = this.suddenDeathCountdownTicks;
    if (countdownTicks === TIME_LOW_SECONDS * TICK_RATE) this.events.emit('round-time-low', {});
    if (countdownTicks > 0 && countdownTicks <= TIMER_URGENT_SECONDS * TICK_RATE && countdownTicks % TICK_RATE === 0) {
      this.events.emit('timer-ticked', { secondsRemaining: countdownTicks / TICK_RATE });
    }
    if (this.mode === 'hill') return;
    if (this.suddenDeathPhase === 'none' && this.fightTicks >= SUDDEN_DEATH_ROUND_TICKS) {
      this.suddenDeathPhase = 'warning';
      this.events.emit('sudden-death-started', {});
    } else if (
      this.suddenDeathPhase === 'warning' &&
      this.fightTicks >= SUDDEN_DEATH_ROUND_TICKS + SUDDEN_DEATH_WARNING_TICKS
    ) {
      this.suddenDeathPhase = 'rising';
    }

    if (this.suddenDeathPhase === 'rising') {
      this.waterLineY = Math.max(this.level.suddenDeathLineY, this.waterLineY - this.suddenDeathRisePerTick);
    }
  }

  updatePlayers(inputByPlayerId) {
    const platforms = this.entityGroups.get('platforms');
    for (const player of this.players) {
      const wasOnGround = player.onGround;
      const fallSpeed = player.velocityY;
      player.update(inputByPlayerId ? inputByPlayerId[player.id] : null, platforms);
      const feet = { playerId: player.id, x: player.x + player.width / 2, y: player.y + player.height };
      if (player.ticksSinceJump === 0) this.events.emit('player-jumped', feet);
      if (player.springJumped) this.events.emit('spring-jumped', feet);
      if (player.onGround && !wasOnGround && fallSpeed >= HARD_LANDING_SPEED) this.events.emit('player-landed', feet);
      if (player.playedCardName) {
        this.events.emit('card-played', { playerId: player.id, cardName: player.playedCardName });
        if (player.playedCardName === 'rocket') this.spawnRocket(player);
        if (player.playedCardName === 'bouncePad') this.spawnBouncePad(player);
        if (player.playedCardName === 'bomb') this.spawnBomb(player);
        if (player.playedCardName === 'banana') this.spawnBanana(player);
        if (player.playedCardName === 'freeze') this.spawnIceShot(player);
        if (player.playedCardName === 'magnet') this.startMagnet(player);
      }
      if (player.shoveJustFullyCharged) this.events.emit('shove-fully-charged', { playerId: player.id });
      if (
        player.shoveCharging &&
        player.shoveChargeTicks > SHOVE_WINDUP_TICKS &&
        player.shoveChargeTicks < SHOVE_MAX_CHARGE_TICKS &&
        player.shoveChargeTicks % SHOVE_CHARGE_REPORT_INTERVAL_TICKS === 0
      ) {
        const charge = (player.shoveChargeTicks - SHOVE_WINDUP_TICKS) / (SHOVE_MAX_CHARGE_TICKS - SHOVE_WINDUP_TICKS);
        this.events.emit('shove-charging', { playerId: player.id, charge });
      }
      if (player.shoveJustStarted) {
        this.shoveHitIdsByShoverId.set(player.id, new Set());
        const hitZone = player.shoveHitZone;
        this.breakBlocksWhere((block) => blockOverlaps(block, hitZone));
      }
      if (player.dashTicksRemaining > 0 && !player.inWater) {
        const reachedBody = {
          x: player.x - DASH_BREAK_REACH,
          y: player.y,
          width: player.width + 2 * DASH_BREAK_REACH,
          height: player.height,
        };
        this.breakBlocksWhere((block) => blockOverlaps(block, reachedBody));
      }
      if (!player.inWater && player.y + player.height >= this.waterLineY) {
        const fallSpeed = player.velocityY;
        player.startSinking();
        const lastKnockout = this.players.filter((candidate) => !candidate.inWater).length <= 1;
        this.events.emit('player-fell-in-water', {
          playerId: player.id,
          fallSpeed,
          splashTier: splashTierFor(fallSpeed, lastKnockout),
          cause: this.recentCauseOf(player.id),
          secondsRemaining: this.suddenDeathPhase === 'none' ? this.suddenDeathCountdownTicks / TICK_RATE : null,
        });
      }
      this.wrapPlayerAroundScreen(player);
    }
    // Hits resolve once everyone has moved, so a freeze lasts the same number of ticks for every player.
    this.resolveShoveClashes();
    for (const shover of this.players) {
      if (!shover.isShoveActive) continue;
      resolveShoveHit({
        events: this.events,
        players: this.players,
        shover,
        alreadyHitIds: this.shoveHitIdsByShoverId.get(shover.id),
      });
      const hitZone = shover.shoveHitZone;
      this.popCrateParachute((bounds) => rectanglesOverlap(bounds, hitZone), shover.facing, 'shove');
      const crate = this.entityGroups.get('crates')[0];
      if (crate) {
        resolveShoveHitOnCrate({
          events: this.events,
          crate,
          shover,
          alreadyHitIds: this.shoveHitIdsByShoverId.get(shover.id),
        });
      }
    }
    this.resolvePlayerCollisions();
  }

  recordCause(playerId, cause) {
    this.recentCauseByPlayerId.set(playerId, { cause, tick: this.tickCount });
  }

  // 'rocket' or 'banana' when one of them hit the player in the last CALLOUT_CAUSE_TICKS ticks, otherwise null.
  recentCauseOf(playerId) {
    const recent = this.recentCauseByPlayerId.get(playerId);
    return recent && this.tickCount - recent.tick <= CALLOUT_CAUSE_TICKS ? recent.cause : null;
  }

  // Resolves every pair in a fixed order, once per pair of shoves.
  resolveShoveClashes() {
    const players = this.players;
    for (let firstIndex = 0; firstIndex < players.length; firstIndex++) {
      for (let secondIndex = firstIndex + 1; secondIndex < players.length; secondIndex++) {
        this.resolveShoveClash(players[firstIndex], players[secondIndex]);
      }
    }
  }

  // Shoves clash when the players face each other, one shove is active and the other is winding up or just fired, and
  // a hit zone reaches the other body. The stronger charge wins with reduced knockback. Otherwise neither lands and
  // both players bounce apart, which also cancels a shove still winding up.
  resolveShoveClash(playerA, playerB) {
    const pairId = [playerA.id, playerB.id].sort().join('-');
    const leftPlayer = playerA.x <= playerB.x ? playerA : playerB;
    const rightPlayer = leftPlayer === playerA ? playerB : playerA;
    const shovesAreClashing =
      (leftPlayer.isShoveActive || rightPlayer.isShoveActive) &&
      leftPlayer.isShoveClashable &&
      rightPlayer.isShoveClashable &&
      !leftPlayer.inWater &&
      !rightPlayer.inWater &&
      leftPlayer.facing > 0 &&
      rightPlayer.facing < 0 &&
      (rightPlayer.overlaps(leftPlayer.shoveHitZone) || leftPlayer.overlaps(rightPlayer.shoveHitZone));
    if (!shovesAreClashing) {
      this.shoveClashPairIds.delete(pairId);
      return;
    }
    if (this.shoveClashPairIds.has(pairId)) return;

    this.shoveClashPairIds.add(pairId);
    for (const [shover, opponent] of [
      [playerA, playerB],
      [playerB, playerA],
    ]) {
      if (shover.isShoveActive) this.shoveHitIdsByShoverId.get(shover.id).add(opponent.id);
    }
    const chargeLead = playerA.shoveClashCharge - playerB.shoveClashCharge;
    if (Math.abs(chargeLead) >= SHOVE_CLASH_CHARGE_MARGIN) {
      const winner = chargeLead > 0 ? playerA : playerB;
      knockBackShoveTarget({
        events: this.events,
        shover: winner,
        opponent: winner === playerA ? playerB : playerA,
        knockbackScale: SHOVE_CLASH_WIN_KNOCKBACK_MULTIPLIER,
      });
    } else {
      leftPlayer.freeze('light', -SHOVE_CLASH_BOUNCE_VELOCITY_X, 0);
      rightPlayer.freeze('light', SHOVE_CLASH_BOUNCE_VELOCITY_X, 0);
    }
    const centerX = (leftPlayer.x + leftPlayer.width / 2 + rightPlayer.x + rightPlayer.width / 2) / 2;
    const centerY = (leftPlayer.y + leftPlayer.height / 2 + rightPlayer.y + rightPlayer.height / 2) / 2;
    this.events.emit('shove-clash', { x: centerX, y: centerY, playerIds: [playerA.id, playerB.id] });
  }

  spawnRocket(player) {
    const spawnX = player.facing > 0 ? player.x + player.width : player.x - ROCKET_WIDTH;
    const spawnY = player.y + player.height / 2 - ROCKET_HEIGHT / 2;
    this.entityGroups.add('rockets', new Rocket({ x: spawnX, y: spawnY, facing: player.facing, shooterId: player.id }));
  }

  updateHazards() {
    for (const hazard of this.entityGroups.get('hazards')) hazard.update(this);
  }

  updateRockets() {
    const platforms = this.entityGroups.get('platforms');
    for (const rocket of this.entityGroups.get('rockets')) {
      rocket.update(this.players, platforms);
      wrapAroundScreen(rocket);
      if (!rocket.exploded) {
        this.popCrateParachute((bounds) => rectanglesOverlap(bounds, rocket), Math.sign(rocket.velocityX), 'rocket');
      }
      if (rocket.exploded && blastIsReady(rocket, this.players, rocket.shooterId)) this.resolveRocketExplosion(rocket);
    }
  }

  resolveRocketExplosion(rocket) {
    const blastCenterX = rocket.x + rocket.width / 2;
    const blastCenterY = rocket.y + rocket.height / 2;
    const playerIds = this.resolveBlast(blastCenterX, blastCenterY);
    for (const playerId of playerIds) if (playerId !== rocket.shooterId) this.recordCause(playerId, 'rocket');
    this.events.emit('rocket-exploded', { x: blastCenterX, y: blastCenterY, playerIds, strength: BLAST_STRENGTH });
    this.entityGroups.remove('rockets', rocket);
  }

  resolveBlast(blastCenterX, blastCenterY) {
    const crate = this.entityGroups.get('crates')[0];
    const crateVelocityX = crate ? crateSlideVelocity(crate, blastCenterX, blastCenterY, BLAST_SLIDE_SPEED) : 0;
    if (crateVelocityX !== 0) crate.slide(crateVelocityX);
    const knockedPlayerIds = knockBackPlayersInBlast(this.players, blastCenterX, blastCenterY);
    this.breakBlocksWhere((block) => blockIsInBlast(block, blastCenterX, blastCenterY));
    if (crate) {
      this.popCrateParachute(
        (bounds) => blastReaches(bounds, blastCenterX, blastCenterY),
        crate.x + crate.width / 2 - blastCenterX,
        'blast',
      );
    }
    return knockedPlayerIds;
  }

  spawnBomb(player) {
    const spawnX = player.facing > 0 ? player.x + player.width : player.x - BOMB_WIDTH;
    const spawnY = player.y + player.height / 2 - BOMB_HEIGHT / 2;
    this.entityGroups.add('bombs', new Bomb({ x: spawnX, y: spawnY, facing: player.facing, throwerId: player.id }));
  }

  updateBombs() {
    const platforms = this.entityGroups.get('platforms');
    for (const bomb of this.entityGroups.get('bombs')) {
      bomb.update(this.players, platforms, this.waterLineY);
      wrapAroundScreen(bomb);
      if (!bomb.exploded) {
        this.popCrateParachute((bounds) => rectanglesOverlap(bounds, bomb), Math.sign(bomb.velocityX), 'bomb');
      }
      if (!bomb.exploded || !blastIsReady(bomb, this.players, bomb.throwerId)) continue;

      const blastCenterX = bomb.x + bomb.width / 2;
      const blastCenterY = bomb.y + bomb.height / 2;
      const playerIds = this.resolveBlast(blastCenterX, blastCenterY);
      this.events.emit('bomb-exploded', { x: blastCenterX, y: blastCenterY, playerIds, strength: BLAST_STRENGTH });
      this.entityGroups.remove('bombs', bomb);
    }
  }

  // Pass the bomb's fuse ran out on this player: they are out, and the blast knocks back anyone near.
  blowUpPlayer(player) {
    player.blowUp();
    const blastCenterX = player.x + player.width / 2;
    const blastCenterY = player.y + player.height / 2;
    const playerIds = this.resolveBlast(blastCenterX, blastCenterY);
    this.events.emit('player-blown-up', { playerId: player.id });
    this.events.emit('bomb-exploded', { x: blastCenterX, y: blastCenterY, playerIds, strength: BLAST_STRENGTH });
  }

  spawnIceShot(player) {
    const x = player.facing > 0 ? player.x + player.width : player.x - ICE_SHOT_WIDTH;
    const y = player.y + player.height / 2 - ICE_SHOT_HEIGHT / 2;
    this.entityGroups.add('iceShots', new IceShot({ x, y, facing: player.facing, shooterId: player.id }));
  }

  updateIceShots() {
    const platforms = this.entityGroups.get('platforms');
    for (const iceShot of this.entityGroups.get('iceShots')) {
      iceShot.update(this.players, platforms);
      wrapAroundScreen(iceShot);
      if (!iceShot.finished) continue;

      const target = this.players.find((player) => player.id === iceShot.hitPlayerId);
      const x = iceShot.x + iceShot.width / 2;
      const y = iceShot.y + iceShot.height / 2;
      if (target) {
        target.freezeSolid();
        this.events.emit('player-iced', { shooterId: iceShot.shooterId, targetId: target.id, x, y });
      } else {
        this.events.emit('ice-shattered', { x, y });
      }
      this.entityGroups.remove('iceShots', iceShot);
    }
  }

  startMagnet(player) {
    const targetIds = this.players.filter((other) => other !== player && !other.inWater).map((other) => other.id);
    this.events.emit('magnet-pulled', { playerId: player.id, targetIds });
  }

  // Pulls sideways only, straight across the screen, and never slower than a pull already carrying the player.
  updateMagnets() {
    for (const puller of this.players) {
      if (puller.magnetTicksRemaining <= 0) continue;
      puller.magnetTicksRemaining = puller.inWater ? 0 : puller.magnetTicksRemaining - 1;
      for (const target of this.players) {
        if (target === puller || target.inWater) continue;
        const distanceX = puller.x - target.x;
        if (Math.abs(distanceX) <= MAGNET_STOP_DISTANCE) continue;
        const direction = Math.sign(distanceX);
        if (target.knockbackVelocityX * direction < MAGNET_PULL_SPEED) {
          target.knockbackVelocityX = direction * MAGNET_PULL_SPEED;
        }
      }
    }
  }

  // Dropped just behind the player, then falls to the ground from there, or into the sea.
  spawnBanana(player) {
    const x = player.facing > 0 ? player.x - BANANA_WIDTH : player.x + player.width;
    const y = player.y + player.height - BANANA_HEIGHT;
    this.entityGroups.add('bananas', new Banana({ x, y, dropperId: player.id }));
  }

  updateBananas() {
    const platforms = this.entityGroups.get('platforms');
    for (const banana of this.entityGroups.get('bananas')) {
      banana.update(platforms);
      if (banana.expired || banana.y + banana.height >= this.waterLineY) {
        this.entityGroups.remove('bananas', banana);
        continue;
      }
      const slippingPlayer = this.players.find((player) => banana.canSlip(player) && player.overlaps(banana));
      if (!slippingPlayer) continue;

      slippingPlayer.makeSlip(BANANA_SLIP_TICKS);
      this.recordCause(slippingPlayer.id, 'banana');
      this.events.emit('player-slipped', { playerId: slippingPlayer.id });
      this.entityGroups.remove('bananas', banana);
    }
  }

  // Placed under the player's feet wherever they are, even in midair over the sea. It only ever
  // affects the other players.
  spawnBouncePad(player) {
    const x = player.x + player.width / 2 - BOUNCE_PAD_WIDTH / 2;
    const y = player.y + player.height - BOUNCE_PAD_HEIGHT;
    this.entityGroups.add('bouncePads', new BouncePad({ x, y, ownerId: player.id }));
  }

  updateBouncePads() {
    for (const bouncePad of this.entityGroups.get('bouncePads')) {
      bouncePad.update();
      if (bouncePad.expired) {
        this.entityGroups.remove('bouncePads', bouncePad);
        continue;
      }
      if (bouncePad.ownerId === null) this.launchPlayersLandingOn(bouncePad);
      else this.flingFirstOpponentTouching(bouncePad);
    }
  }

  launchPlayersLandingOn(bouncePad) {
    for (const player of this.players) {
      if (!player.inWater && bouncePad.isLandedOnBy(player)) {
        player.launchUpward(BOUNCE_PAD_LAUNCH_VELOCITY);
      }
    }
  }

  // The trap throws the opponent back the way they came, or away from its center if they stood
  // still, then breaks.
  flingFirstOpponentTouching(bouncePad) {
    for (const player of this.players) {
      if (player.id === bouncePad.ownerId || player.inWater || !player.overlaps(bouncePad)) continue;

      const movingDirection = Math.sign(player.velocityX + player.knockbackVelocityX);
      const awayFromCenterDirection = player.x + player.width / 2 < bouncePad.x + bouncePad.width / 2 ? -1 : 1;
      const flingDirection = movingDirection === 0 ? awayFromCenterDirection : -movingDirection;
      player.freeze('light', BOUNCE_PAD_FLING_VELOCITY_X * flingDirection, BOUNCE_PAD_FLING_VELOCITY_Y);
      this.events.emit('trap-sprung', {
        ownerId: bouncePad.ownerId,
        targetId: player.id,
        directionX: 0,
        directionY: -1,
        strength: 'light',
      });
      this.entityGroups.remove('bouncePads', bouncePad);
      return;
    }
  }

  updateCrates() {
    const crate = this.entityGroups.get('crates')[0];
    if (!crate) {
      this.ticksUntilCrateSpawn--;
      if (this.ticksUntilCrateSpawn <= 0) this.spawnCrate();
      return;
    }

    crate.update(this.entityGroups.get('platforms'));
    wrapAroundScreen(crate);
    if (crate.y + crate.height >= this.waterLineY) {
      this.events.emit('crate-fell-in-water', { x: crate.x + crate.width / 2, y: this.waterLineY });
      this.entityGroups.remove('crates', crate);
      this.scheduleNextCrate();
      return;
    }
    if (crate.isFalling) this.checkCratePickup(crate);
  }

  // Pops the falling crate's parachute when `isHit` says the hit reaches it. The canopy flutters off toward `directionX`.
  popCrateParachute(isHit, directionX, cause) {
    const crate = this.entityGroups.get('crates')[0];
    const bounds = crate?.parachuteBounds;
    if (!bounds || !isHit(bounds)) return;
    crate.popParachute(directionX, this.entityGroups.get('platforms'));
    this.events.emit('crate-parachute-popped', {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
      cause,
    });
  }

  // The landing spot and the card both come from the scene's seeded random, so the same seed
  // always drops the same crates in the same places.
  spawnCrate() {
    const openTops = this.openTops.filter((openTop) => openTop.y < this.waterLineY);
    if (openTops.length === 0) return; // no dry platform right now; try again next tick

    const openTop = openTops[Math.floor(this.random.next() * openTops.length)];
    const cardName = crateCardFor(this.random.next());
    const x = openTop.x + this.random.next() * (openTop.width - CRATE_WIDTH);
    const y = openTop.y - CRATE_HEIGHT;
    const golden = !this.goldenCrateSpawned && this.fightTicks >= GOLDEN_CRATE_AFTER_TICKS;
    if (golden) this.goldenCrateSpawned = true;
    const crate = new Crate({ x, y, cardName, golden });
    crate.predictLanding(this.entityGroups.get('platforms'));
    this.entityGroups.add('crates', crate);
  }

  scheduleNextCrate() {
    this.ticksUntilCrateSpawn = this.crateSpawnDelayTicks();
  }

  checkCratePickup(crate) {
    for (const player of this.players) {
      if (!player.overlaps(crate)) continue;
      if (!player.receiveCard(crate.cardName, crate.golden ? GOLDEN_PICKUP_USES : PICKUP_USES)) continue;

      this.events.emit('card-picked-up', {
        playerId: player.id,
        cardName: crate.cardName,
        golden: crate.golden,
        x: crate.x + crate.width / 2,
        y: crate.y,
      });
      this.entityGroups.remove('crates', crate);
      this.scheduleNextCrate();
      return;
    }
  }

  wrapPlayerAroundScreen(player) {
    if (!wrapAroundScreen(player)) return;
    this.events.emit('player-wrapped', { playerId: player.id, x: player.x, y: player.y });
  }

  // Resolves every pair in a fixed order so the outcome never depends on iteration order.
  resolvePlayerCollisions() {
    const players = this.players;
    for (let firstIndex = 0; firstIndex < players.length; firstIndex++) {
      for (let secondIndex = firstIndex + 1; secondIndex < players.length; secondIndex++) {
        this.resolvePlayerPair(players[firstIndex], players[secondIndex]);
      }
    }
  }

  // Players pass through each other. Only a dash hurts: it knocks both players apart once per contact.
  resolvePlayerPair(playerA, playerB) {
    const pairId = [playerA.id, playerB.id].sort().join('-');
    const isDashing = playerA.dashTicksRemaining > 0 || playerB.dashTicksRemaining > 0;
    if (playerA.inWater || playerB.inWater || !isDashing) {
      this.dashHitPairIds.delete(pairId);
      return;
    }

    if (this.playersAreTouching(playerA, playerB, 0)) {
      const leftPlayer = playerA.x <= playerB.x ? playerA : playerB;
      const rightPlayer = leftPlayer === playerA ? playerB : playerA;
      if (!this.dashHitPairIds.has(pairId)) {
        this.dashHitPairIds.add(pairId);
        leftPlayer.freeze('medium', -DASH_KNOCKBACK_VELOCITY_X, 0);
        rightPlayer.freeze('medium', DASH_KNOCKBACK_VELOCITY_X, 0);
        const dasher = playerA.dashTicksRemaining > 0 ? playerA : playerB;
        this.events.emit('dash-hit', {
          playerIds: [playerA.id, playerB.id],
          directionX: dasher.facing,
          directionY: 0,
          strength: 'medium',
        });
      }
    }

    if (!this.playersAreTouching(playerA, playerB, DASH_CONTACT_GAP)) this.dashHitPairIds.delete(pairId);
  }

  // A player whose feet are clearly above the other's head is jumping over them, not touching them.
  // horizontalPadding widens the gap that still counts as touching, so a hit kept apart by a few pixels
  // is still the same contact instead of a fresh one.
  playersAreTouching(playerA, playerB, horizontalPadding) {
    const higherPlayer = playerA.y < playerB.y ? playerA : playerB;
    const lowerPlayer = higherPlayer === playerA ? playerB : playerA;
    if (higherPlayer.y + higherPlayer.height <= lowerPlayer.y + DASH_HEAD_CLEARANCE) return false;

    const leftPlayer = playerA.x <= playerB.x ? playerA : playerB;
    const rightPlayer = leftPlayer === playerA ? playerB : playerA;
    return leftPlayer.x + leftPlayer.width + horizontalPadding > rightPlayer.x;
  }

  checkRoundEnd() {
    if (this.mode === 'hill') {
      if (this.suddenDeathCountdownTicks === 0) this.awardRound(this.modeRules.winnerId());
      return;
    }
    const standingPlayers = this.players.filter((player) => !player.inWater);
    if (standingPlayers.length > 1) return;

    this.phase = 'knockout';
    this.ticksRemaining = KNOCKOUT_SLOWMO_TICKS;
    this.knockoutTicks = 1;
    this.knockoutFocusPlayerId = this.players.find((player) => player.inWater)?.id ?? null;
    const lastStanding = standingPlayers[0];
    if (lastStanding && this.wins[lastStanding.id] + 1 >= this.winsNeeded)
      this.events.emit('final-knockout', { playerId: lastStanding.id });
  }

  endRound() {
    const standingPlayers = this.players.filter((player) => !player.inWater);
    this.awardRound(standingPlayers[0]?.id ?? null);
  }

  // A null winner is a draw.
  awardRound(winnerId) {
    this.phase = 'point';
    this.ticksRemaining = POINT_PAUSE_TICKS;
    if (!winnerId) return;

    this.winnerId = winnerId;
    this.wins[this.winnerId]++;
    this.events.emit('round-won', { playerId: this.winnerId, wins: this.wins[this.winnerId] });
    if (this.wins[this.winnerId] >= this.winsNeeded) {
      const winner = this.players.find((player) => player.id === this.winnerId);
      this.events.emit('match-won', { playerId: this.winnerId, characterName: winner.character.name });
      this.phase = 'match';
      this.ticksRemaining = RESTART_DELAY_TICKS;
    }
  }

  startNewMatch() {
    for (const id in this.wins) this.wins[id] = 0;
    this.matchStats.reset();
    this.roundNumber = 0;
    this.pendingModifierId = null;
    this.events.emit('match-started', {});
    this.startRound();
  }

  render(renderer) {
    if (!this.backgroundDrawn) {
      renderer.updateBackground((context) => drawArenaBackground(context, this.level.background));
      this.backgroundDrawn = true;
    }

    renderer.shakeOffset = this.screenShake.offset;
    renderer.zoom = knockoutZoom(this);
    renderer.seaRippleBytes = this.seaRipple.toBytes();
    renderer.clearGameLayer();
    for (const tile of this.level.tiles) {
      if (!this.brokenTiles.has(tile))
        renderer.gameContext.drawImage(this.level.tileSprites[tile.name], tile.x, tile.y);
    }
    if (this.mode === 'hill') drawHillZone(renderer.gameContext, this);
    drawWrapPuffs(renderer.gameContext, this);
    this.characterAnimations.render(renderer.gameContext);
    this.entityGroups.renderAll(renderer.gameContext, {
      sprites: this.sprites,
      playerEyes: this.playerEyes,
      characterAnimations: this.characterAnimations,
      arenaName: this.level.background,
    });
    this.crateOpenings.render(renderer.gameContext);
    if (this.mode === 'bomb') drawHeldBomb(renderer.gameContext, this);
    drawMagnetField(renderer.gameContext, this);
    drawSplashes(renderer.gameContext, this);
    drawParticles(renderer.gameContext, this);
    drawClashSparks(renderer.gameContext, this);
    drawHeldCardIcons(renderer.gameContext, this);
    drawPlayerTags(renderer.gameContext, this);

    renderer.clearUiLayer();
    drawHud(renderer.uiContext, this);
    drawRoundIntro(renderer.uiContext, this);
    drawModifierPick(renderer.uiContext, this);
    this.callouts.draw(renderer.uiContext, this.tickCount, renderer.zoom, this.waterLineY);
    this.confetti.render(renderer.uiContext);
  }
}
