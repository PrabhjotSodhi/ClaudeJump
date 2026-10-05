import { ComputerPlayer } from '../computer/computer-player.js';
import { touchLayoutForPlayers } from '../engine/touch-input.js';
import { crateCardFor, GOLDEN_PICKUP_USES, PICKUP_USES } from '../cards/card-definitions.js';
import {
  spawnBanana,
  spawnBomb,
  spawnBouncePad,
  spawnIceShot,
  spawnRocket,
  startMagnet,
  updateCardItems,
  updateFlyingCardItems,
} from '../cards/card-items.js';
import {
  CALLOUT_CAUSE_TICKS,
  GOLDEN_CRATE_AFTER_TICKS,
  KNOCKOUT_SLOWMO_STEP_INTERVAL,
  KNOCKOUT_SLOWMO_TICKS,
  MODIFIER_EVERY_N_ROUNDS,
  MODIFIER_PICK_TICKS,
  ROUND_COUNTDOWN_BEAT_TICKS,
  ROUND_COUNTDOWN_TICKS,
  ROUND_GO_TICKS,
  ROUND_MODIFIERS,
  SCREEN_WIDTH,
  SHOVE_CHARGE_REPORT_INTERVAL_TICKS,
  SHOVE_MAX_CHARGE_TICKS,
  SHOVE_WINDUP_TICKS,
  TICK_RATE,
  TIMER_URGENT_SECONDS,
  TIME_LOW_SECONDS,
} from '../engine/config.js';
import { BLAST_STRENGTH, blastReaches, crateSlideVelocity, knockBackPlayersInBlast } from '../engine/blast.js';
import { EntityGroups } from '../engine/entity-groups.js';
import { EventEmitter } from '../engine/events.js';
import { SeededRandom } from '../engine/seeded-random.js';
import { wrapAroundScreen } from '../engine/wrap-around-screen.js';
import { BouncePad } from '../entities/bounce-pad.js';
import { DEFAULT_JOINED_PLAYERS } from '../entities/characters.js';
import { BLAST_SLIDE_SPEED, Crate, CRATE_WIDTH, CRATE_HEIGHT, CRATE_WARNING_TICKS } from '../entities/crate.js';
import { Player } from '../entities/player.js';
import { resolveShoveHit, resolveShoveHitOnCrate } from '../entities/shove.js';
import { HoldTheHill } from './hold-the-hill.js';
import { PassTheBomb } from './pass-the-bomb.js';
import { resolvePlayerCollisions, resolveShoveClashes } from './player-clashes.js';
import { drawArenaBackground, drawArenaMotion } from '../levels/arena-backgrounds.js';
import { blockIsInBlast, blockOverlaps, BreakableArena } from '../levels/breakable-arena.js';
import { createHazards } from '../levels/level-hazards.js';
import { PLAYERS } from '../levels/versus-arena.js';
import { drawHeldCardIcons } from '../ui/held-card-icons.js';
import { Callouts } from '../ui/callouts.js';
import { drawHud } from '../ui/hud.js';
import { drawModifierPick } from '../ui/modifier-pick.js';
import { drawRoundIntro, isMatchPoint } from '../ui/round-intro.js';
import { MatchStats } from '../ui/match-stats.js';
import { drawPlayerTags } from '../ui/player-tags.js';
import { WinPips } from '../ui/win-pips.js';
import { BlastClouds, drawBlastClouds } from '../vfx/blast-cloud.js';
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
    this.touchLayout = touchLayoutForPlayers(players);
    // The joined players, each { id, character, computer }, in seat order. Every level has a spawn for each id. A
    // computer player's input comes from a ComputerPlayer instead of the input records.
    this.joinedPlayers = players;
    this.computerPlayers = players
      .filter((player) => player.computer)
      .map((player) => new ComputerPlayer(player.id, players.indexOf(player)));
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
    this.breakableArena = new BreakableArena({ level, entityGroups: this.entityGroups, events: this.events });
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
    this.blastClouds = new BlastClouds();
    this.blastClouds.attach(
      this.events,
      () => this.players,
      () => this.tickCount,
    );
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

  get blocks() {
    return this.breakableArena.blocks;
  }

  get solidCells() {
    return this.breakableArena.solidCells;
  }

  get brokenTiles() {
    return this.breakableArena.brokenTiles;
  }

  get openTops() {
    return this.breakableArena.openTops;
  }

  removeSolidCell(column, row) {
    this.breakableArena.removeSolidCell(column, row);
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
    this.breakableArena.restoreBlocks();
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

  update(inputByPlayerId) {
    if (this.computerPlayers.length > 0) {
      inputByPlayerId = { ...inputByPlayerId };
      for (const computer of this.computerPlayers) inputByPlayerId[computer.playerId] = computer.inputFor(this);
    }
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
        updateCardItems(this);
        this.updateCrates();
        this.modeRules?.update(this);
        this.checkRoundEnd();
        break;
      case 'knockout':
        if (worldSteps) {
          this.updatePlayers(null);
          updateFlyingCardItems(this);
        }
        if (this.ticksRemaining <= 0) this.endRound();
        break;
      case 'point':
        this.updatePlayers(null);
        updateFlyingCardItems(this);
        if (this.ticksRemaining <= 0) this.startNextRound();
        break;
      case 'modifier':
        this.updateModifierPick(inputByPlayerId);
        break;
      case 'match':
        this.updatePlayers(null);
        updateFlyingCardItems(this);
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
        if (player.playedCardName === 'rocket') spawnRocket(this, player);
        if (player.playedCardName === 'bouncePad') spawnBouncePad(this, player);
        if (player.playedCardName === 'bomb') spawnBomb(this, player);
        if (player.playedCardName === 'banana') spawnBanana(this, player);
        if (player.playedCardName === 'freeze') spawnIceShot(this, player);
        if (player.playedCardName === 'magnet') startMagnet(this, player);
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
        this.breakableArena.breakBlocksWhere((block) => blockOverlaps(block, hitZone));
      }
      if (player.dashTicksRemaining > 0 && !player.inWater) {
        const reachedBody = {
          x: player.x - DASH_BREAK_REACH,
          y: player.y,
          width: player.width + 2 * DASH_BREAK_REACH,
          height: player.height,
        };
        this.breakableArena.breakBlocksWhere((block) => blockOverlaps(block, reachedBody));
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
    resolveShoveClashes(this);
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
    resolvePlayerCollisions(this);
  }

  recordCause(playerId, cause) {
    this.recentCauseByPlayerId.set(playerId, { cause, tick: this.tickCount });
  }

  // 'rocket' or 'banana' when one of them hit the player in the last CALLOUT_CAUSE_TICKS ticks, otherwise null.
  recentCauseOf(playerId) {
    const recent = this.recentCauseByPlayerId.get(playerId);
    return recent && this.tickCount - recent.tick <= CALLOUT_CAUSE_TICKS ? recent.cause : null;
  }

  updateHazards() {
    for (const hazard of this.entityGroups.get('hazards')) hazard.update(this);
  }

  resolveBlast(blastCenterX, blastCenterY) {
    const crate = this.entityGroups.get('crates')[0];
    const crateVelocityX = crate ? crateSlideVelocity(crate, blastCenterX, blastCenterY, BLAST_SLIDE_SPEED) : 0;
    if (crateVelocityX !== 0) crate.slide(crateVelocityX);
    const knockedPlayerIds = knockBackPlayersInBlast(this.players, blastCenterX, blastCenterY);
    this.breakableArena.breakBlocksWhere((block) => blockIsInBlast(block, blastCenterX, blastCenterY));
    if (crate) {
      this.popCrateParachute(
        (bounds) => blastReaches(bounds, blastCenterX, blastCenterY),
        crate.x + crate.width / 2 - blastCenterX,
        'blast',
      );
    }
    return knockedPlayerIds;
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
      this.events.emit('crate-fell-in-water', {
        x: crate.x + crate.width / 2,
        y: this.waterLineY,
        golden: crate.golden,
      });
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
    drawArenaMotion(renderer.gameContext, this.level.background, this.tickCount);
    for (const tile of this.level.tiles) {
      if (!this.brokenTiles.has(tile))
        renderer.gameContext.drawImage(this.level.tileSprites[tile.name], tile.x, tile.y);
    }
    if (this.mode === 'hill') drawHillZone(renderer.gameContext, this);
    drawWrapPuffs(renderer.gameContext, this);
    drawParticles(renderer.gameContext, this, 'behind', renderer.glowContext);
    this.entityGroups.renderAll(renderer.gameContext, {
      sprites: this.sprites,
      playerEyes: this.playerEyes,
      characterAnimations: this.characterAnimations,
      glowContext: renderer.glowContext,
      arenaName: this.level.background,
    });
    for (const player of this.players) player.renderLandedShovel(renderer.gameContext, this.sprites);
    this.crateOpenings.render(renderer.gameContext);
    if (this.mode === 'bomb') drawHeldBomb(renderer.gameContext, this);
    drawMagnetField(renderer.gameContext, this);
    drawSplashes(renderer.gameContext, this);
    drawParticles(renderer.gameContext, this, 'front', renderer.glowContext);
    drawBlastClouds(renderer.gameContext, this, renderer.glowContext);
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
