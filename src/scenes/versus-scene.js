import { CARD_NAMES } from '../cards/card-definitions.js';
import { SCREEN_WIDTH, TILE_SIZE } from '../engine/config.js';
import { knockBackPlayersInBlast } from '../engine/blast.js';
import { EntityGroups } from '../engine/entity-groups.js';
import { EventEmitter } from '../engine/events.js';
import { SeededRandom } from '../engine/seeded-random.js';
import { wrapAroundScreen } from '../engine/wrap-around-screen.js';
import { Banana, BANANA_WIDTH, BANANA_HEIGHT, BANANA_SLIP_TICKS } from '../entities/banana.js';
import { Bomb, BOMB_WIDTH, BOMB_HEIGHT } from '../entities/bomb.js';
import {
  BouncePad,
  BOUNCE_PAD_WIDTH,
  BOUNCE_PAD_HEIGHT,
  BOUNCE_PAD_LAUNCH_VELOCITY,
  BOUNCE_PAD_FLING_VELOCITY_X,
  BOUNCE_PAD_FLING_VELOCITY_Y,
} from '../entities/bounce-pad.js';
import { DEFAULT_CHARACTER_BY_PLAYER_ID } from '../entities/characters.js';
import { Crate, CRATE_WIDTH, CRATE_HEIGHT, CRATE_WARNING_TICKS } from '../entities/crate.js';
import { Platform } from '../entities/platform.js';
import { Player, SHOVE_KNOCKBACK_VELOCITY_X, SHOVE_KNOCKBACK_VELOCITY_Y } from '../entities/player.js';
import { Rocket, ROCKET_WIDTH, ROCKET_HEIGHT } from '../entities/rocket.js';
import { drawArenaBackground } from '../levels/arena-backgrounds.js';
import { solidRuns } from '../levels/level-loader.js';
import { drawHeldCardIcons } from '../ui/held-card-icons.js';
import { drawHud } from '../ui/hud.js';
import { MatchStats } from '../ui/match-stats.js';
import { drawPlayerTags } from '../ui/player-tags.js';
import { PlayerEyes } from '../vfx/player-eyes.js';
import { drawParticles, HARD_LANDING_SPEED, Particles } from '../vfx/particles.js';
import { SeaRipple } from '../vfx/sea-ripple.js';
import { ScreenShake } from '../vfx/screen-shake.js';
import { drawWrapPuffs, WrapPuffTracker } from '../vfx/wrap-puff.js';

// How many ticks all game logic freezes after each kind of hit. Overlapping hits take the longer
// pause, they never add up.
const SHOVE_HIT_PAUSE_TICKS = 3;
const DASH_HIT_PAUSE_TICKS = 4;
const BLAST_HIT_PAUSE_TICKS = 6;

const WINS_NEEDED = 5;
const READY_TICKS = 60;
const GO_TICKS = 30;
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
  return Math.hypot(nearestX - blastCenterX, nearestY - blastCenterY) <= BLOCK_BLAST_RADIUS;
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
    characterByPlayerId = DEFAULT_CHARACTER_BY_PLAYER_ID,
    sprites = {},
    levels = [],
  } = {}) {
    this.characterByPlayerId = characterByPlayerId;
    this.sprites = sprites;
    this.levels = levels;
    this.events = new EventEmitter();
    this.random = new SeededRandom(seed);
    this.entityGroups = new EntityGroups();
    this.level = level;
    this.suddenDeathRisePerTick = (level.waterLineY - level.suddenDeathLineY) / SUDDEN_DEATH_RISE_TICKS;

    this.waterLineY = level.waterLineY;
    this.backgroundDrawn = false;
    this.wins = {};
    for (const spawn of level.spawns) this.wins[spawn.id] = 0;
    this.skipNextReadyPhase = startInFightPhase;
    this.dashHitPairIds = new Set();
    // Which opponents each shover has already hit this shove, so one shove lands at most one hit
    // per opponent even while its hit zone stays active for several ticks.
    this.shoveHitIdsByShoverId = new Map();
    // Elapsed scene ticks, kept across rounds. Display-only effects (like the held card flash)
    // time themselves off it instead of off rendered frames.
    this.tickCount = 0;
    this.hitPauseTicksRemaining = 0;
    // Display-only, and created here for the same reason as the stats: it must never miss an event.
    this.screenShake = new ScreenShake();
    this.screenShake.attach(this.events);
    this.seaRipple = new SeaRipple();
    this.seaRipple.attach(this.events, () => this.players);
    this.particles = new Particles();
    this.particles.attach(this.events, {
      getPlayers: () => this.players,
      getWaterLineY: () => this.waterLineY,
      getTickCount: () => this.tickCount,
    });
    // Display data for the results screen, counted only from events. Created here (rather than
    // lazily on first render) so it never misses an event: dev mode can run a whole match through
    // step() with no render call in between. Game logic never reads it, only the HUD does.
    this.matchStats = new MatchStats(Object.keys(this.wins));
    this.matchStats.attach(this.events, () => this.phase === 'fight');
    // Display-only, created here for the same reason: it must never miss a player-wrapped event.
    this.playerEyes = new PlayerEyes();
    this.playerEyes.attach(this.events, () => this.players);
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
    return Math.max(0, SUDDEN_DEATH_ROUND_TICKS - this.fightTicks);
  }

  startRound() {
    // Crates and bounce pads must be cleared (and so, on the first round, first inserted into
    // the entity groups) before players, so they render underneath the players standing on them.
    this.entityGroups.clear('crates');
    this.entityGroups.clear('bouncePads');
    this.entityGroups.clear('bananas');
    this.entityGroups.clear('players');
    this.entityGroups.clear('rockets');
    this.entityGroups.clear('bombs');
    this.restoreBlocks();
    for (const { x, y } of this.level.bouncePads) {
      this.entityGroups.add('bouncePads', new BouncePad({ x, y, lifetimeTicks: Infinity }));
    }
    for (const { id, x, y, facing } of this.level.spawns) {
      this.entityGroups.add(
        'players',
        new Player({ id, character: this.characterByPlayerId[id], spawnX: x, spawnY: y, facing }),
      );
    }
    this.ticksUntilCrateSpawn = CRATE_SPAWN_DELAY_TICKS;
    if (this.skipNextReadyPhase) {
      this.phase = 'fight';
      this.ticksRemaining = GO_TICKS;
      this.skipNextReadyPhase = false;
    } else {
      this.phase = 'ready';
      this.ticksRemaining = READY_TICKS;
    }
    this.winnerId = null;
    this.dashHitPairIds.clear();
    this.shoveHitIdsByShoverId.clear();
    this.waterLineY = this.level.waterLineY;
    this.fightTicks = 0;
    this.suddenDeathPhase = 'none';
    this.hitPauseTicksRemaining = 0;
  }

  // Blocks broken in a round are gone until the next one. The level itself is never changed, so the next round
  // and the thumbnails still see every block.
  restoreBlocks() {
    this.blocks = [...this.level.blocks];
    this.solidCells = this.level.solidCells.map((row) => [...row]);
    this.brokenTiles = new Set();
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
    this.screenShake.update();
    this.seaRipple.update();
    this.particles.update();
    this.playerEyes.update();
    switch (this.phase) {
      case 'ready':
        if (this.ticksRemaining <= 0) {
          this.phase = 'fight';
          this.ticksRemaining = GO_TICKS;
        }
        break;
      case 'fight':
        if (this.hitPauseTicksRemaining > 0) {
          this.hitPauseTicksRemaining--;
          break;
        }
        this.fightTicks++;
        this.updateSuddenDeath();
        this.updatePlayers(inputByPlayerId);
        this.updateRockets();
        this.updateBombs();
        this.updateBouncePads();
        this.updateBananas();
        this.updateCrates();
        this.checkRoundEnd();
        break;
      case 'point':
        this.updatePlayers(null);
        this.updateRockets();
        this.updateBombs();
        if (this.ticksRemaining <= 0) this.startRound();
        break;
      case 'match':
        this.updatePlayers(null);
        this.updateRockets();
        this.updateBombs();
        break;
    }
  }

  requestHitPause(ticks) {
    if (this.phase !== 'fight') return;
    this.hitPauseTicksRemaining = Math.max(this.hitPauseTicksRemaining, ticks);
  }

  updateSuddenDeath() {
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
      if (player.onGround && !wasOnGround && fallSpeed >= HARD_LANDING_SPEED) this.events.emit('player-landed', feet);
      if (player.playedCardName) {
        this.events.emit('card-played', { playerId: player.id, cardName: player.playedCardName });
        if (player.playedCardName === 'rocket') this.spawnRocket(player);
        if (player.playedCardName === 'bouncePad') this.spawnBouncePad(player);
        if (player.playedCardName === 'bomb') this.spawnBomb(player);
        if (player.playedCardName === 'banana') this.spawnBanana(player);
      }
      if (player.shoveJustStarted) {
        this.shoveHitIdsByShoverId.set(player.id, new Set());
        const hitZone = player.shoveHitZone;
        this.breakBlocksWhere((block) => blockOverlaps(block, hitZone));
      }
      if (player.isShoveActive) this.resolveShoveHit(player);
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
        player.startSinking();
        this.events.emit('player-fell-in-water', { playerId: player.id });
      }
      this.wrapPlayerAroundScreen(player);
    }
    this.resolvePlayerCollisions();
  }

  // The first opponent touching the shover's hit zone gets knocked away, once per shove. The pop
  // upward lets air knockback decay carry the hit, so a shove near the edge can end a round.
  resolveShoveHit(shover) {
    const hitZone = shover.shoveHitZone;
    const alreadyHitIds = this.shoveHitIdsByShoverId.get(shover.id);
    for (const opponent of this.players) {
      if (opponent.id === shover.id || opponent.inWater || alreadyHitIds.has(opponent.id)) continue;
      if (!opponent.overlaps(hitZone)) continue;

      alreadyHitIds.add(opponent.id);
      opponent.applyKnockback(SHOVE_KNOCKBACK_VELOCITY_X * shover.facing, SHOVE_KNOCKBACK_VELOCITY_Y);
      this.requestHitPause(SHOVE_HIT_PAUSE_TICKS);
      this.events.emit('player-shoved', { shoverId: shover.id, targetId: opponent.id });
      return;
    }
  }

  spawnRocket(player) {
    const spawnX = player.facing > 0 ? player.x + player.width : player.x - ROCKET_WIDTH;
    const spawnY = player.y + player.height / 2 - ROCKET_HEIGHT / 2;
    this.entityGroups.add('rockets', new Rocket({ x: spawnX, y: spawnY, facing: player.facing, shooterId: player.id }));
  }

  updateRockets() {
    const platforms = this.entityGroups.get('platforms');
    for (const rocket of this.entityGroups.get('rockets')) {
      rocket.update(this.players, platforms);
      wrapAroundScreen(rocket);
      if (rocket.exploded) this.resolveRocketExplosion(rocket);
    }
  }

  resolveRocketExplosion(rocket) {
    const blastCenterX = rocket.x + rocket.width / 2;
    const blastCenterY = rocket.y + rocket.height / 2;
    const playerIds = this.resolveBlast(blastCenterX, blastCenterY);
    this.events.emit('rocket-exploded', { x: blastCenterX, y: blastCenterY, playerIds });
    this.entityGroups.remove('rockets', rocket);
  }

  resolveBlast(blastCenterX, blastCenterY) {
    this.requestHitPause(BLAST_HIT_PAUSE_TICKS);
    const knockedPlayerIds = knockBackPlayersInBlast(this.players, blastCenterX, blastCenterY);
    this.breakBlocksWhere((block) => blockIsInBlast(block, blastCenterX, blastCenterY));
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
      if (!bomb.exploded) continue;

      const blastCenterX = bomb.x + bomb.width / 2;
      const blastCenterY = bomb.y + bomb.height / 2;
      const playerIds = this.resolveBlast(blastCenterX, blastCenterY);
      this.events.emit('bomb-exploded', { x: blastCenterX, y: blastCenterY, playerIds });
      this.entityGroups.remove('bombs', bomb);
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
      player.applyKnockback(BOUNCE_PAD_FLING_VELOCITY_X * flingDirection, BOUNCE_PAD_FLING_VELOCITY_Y);
      this.events.emit('trap-sprung', { ownerId: bouncePad.ownerId, targetId: player.id });
      this.requestHitPause(SHOVE_HIT_PAUSE_TICKS);
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
    if (crate.y + crate.height >= this.waterLineY) {
      this.entityGroups.remove('crates', crate);
      this.scheduleNextCrate();
      return;
    }
    if (crate.isFalling) this.checkCratePickup(crate);
  }

  // The landing spot and the card both come from the scene's seeded random, so the same seed
  // always drops the same crates in the same places.
  spawnCrate() {
    const openTops = this.openTops.filter((openTop) => openTop.y < this.waterLineY);
    if (openTops.length === 0) return; // no dry platform right now; try again next tick

    const openTop = openTops[Math.floor(this.random.next() * openTops.length)];
    const cardName = CARD_NAMES[Math.floor(this.random.next() * CARD_NAMES.length)];
    const x = openTop.x + this.random.next() * (openTop.width - CRATE_WIDTH);
    const y = openTop.y - CRATE_HEIGHT;
    this.entityGroups.add('crates', new Crate({ x, y, cardName }));
  }

  scheduleNextCrate() {
    this.ticksUntilCrateSpawn = CRATE_SPAWN_DELAY_TICKS;
  }

  checkCratePickup(crate) {
    for (const player of this.players) {
      if (!player.overlaps(crate)) continue;
      if (!player.receiveCard(crate.cardName)) continue;

      this.events.emit('card-picked-up', { playerId: player.id, cardName: crate.cardName });
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
        leftPlayer.applyKnockback(-DASH_KNOCKBACK_VELOCITY_X, 0);
        rightPlayer.applyKnockback(DASH_KNOCKBACK_VELOCITY_X, 0);
        this.requestHitPause(DASH_HIT_PAUSE_TICKS);
        this.events.emit('dash-hit', { playerIds: [playerA.id, playerB.id] });
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
    const standingPlayers = this.players.filter((player) => !player.inWater);
    if (standingPlayers.length === this.players.length) return;

    this.phase = 'point';
    this.ticksRemaining = POINT_PAUSE_TICKS;
    if (standingPlayers.length !== 1) return;

    this.winnerId = standingPlayers[0].id;
    this.wins[this.winnerId]++;
    this.events.emit('round-won', { playerId: this.winnerId, wins: this.wins[this.winnerId] });
    if (this.wins[this.winnerId] >= WINS_NEEDED) {
      this.phase = 'match';
      this.ticksRemaining = RESTART_DELAY_TICKS;
    }
  }

  startNewMatch() {
    for (const id in this.wins) this.wins[id] = 0;
    this.matchStats.reset();
    this.events.emit('match-started', {});
    this.startRound();
  }

  render(renderer) {
    if (!this.backgroundDrawn) {
      renderer.updateBackground((context) => drawArenaBackground(context, this.level.background));
      this.backgroundDrawn = true;
    }

    renderer.shakeOffset = this.screenShake.offset;
    renderer.seaRippleBytes = this.seaRipple.toBytes();
    renderer.clearGameLayer();
    for (const tile of this.level.tiles) {
      if (!this.brokenTiles.has(tile))
        renderer.gameContext.drawImage(this.level.tileSprites[tile.name], tile.x, tile.y);
    }
    drawWrapPuffs(renderer.gameContext, this);
    this.entityGroups.renderAll(renderer.gameContext, { sprites: this.sprites, playerEyes: this.playerEyes });
    drawParticles(renderer.gameContext, this);
    drawHeldCardIcons(renderer.gameContext, this);
    drawPlayerTags(renderer.gameContext, this);

    renderer.clearUiLayer();
    drawHud(renderer.uiContext, this);
  }
}
