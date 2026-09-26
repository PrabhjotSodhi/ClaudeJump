import { CARD_NAMES } from '../cards/card-definitions.js';
import { SCREEN_WIDTH } from '../engine/config.js';
import { EntityGroups } from '../engine/entity-groups.js';
import { EventEmitter } from '../engine/events.js';
import { SeededRandom } from '../engine/seeded-random.js';
import { BouncePad, BOUNCE_PAD_WIDTH, BOUNCE_PAD_HEIGHT, BOUNCE_PAD_LAUNCH_VELOCITY } from '../entities/bounce-pad.js';
import { Crate, CRATE_WIDTH, CRATE_HEIGHT, CRATE_WARNING_TICKS } from '../entities/crate.js';
import { Platform } from '../entities/platform.js';
import { Player } from '../entities/player.js';
import { Rocket, ROCKET_WIDTH, ROCKET_HEIGHT } from '../entities/rocket.js';
import { PLATFORM_LAYOUTS, PLAYER_SPAWNS, WATER_LINE_Y, drawBackground } from '../levels/versus-arena.js';
import { drawHud } from '../ui/hud.js';

const WINS_NEEDED = 5;
const READY_TICKS = 60;
const GO_TICKS = 30;
const POINT_PAUSE_TICKS = 90;
const RESTART_DELAY_TICKS = 60;
const BUMP_KNOCKBACK_VELOCITY_X = 1.5;
// How far one player's feet may sit above the other's head and still count as jumping over, not landing on them.
const BUMP_HEAD_CLEARANCE = 4;
// Players pushed apart to a gap this small still count as the same contact, so the push does not refire the event every tick.
const BUMP_CONTACT_GAP = 3;
const STOMP_KNOCKBACK_VELOCITY_X = 2.5;
const STOMP_KNOCKBACK_VELOCITY_Y = 1;
const DIZZY_TICKS = 20;
const DASH_KNOCKBACK_VELOCITY_X = 4;
// How far a rocket blast reaches, and how hard it knocks players inside that range.
const BLAST_RADIUS = 24;
const BLAST_KNOCKBACK_VELOCITY_X = 4;
const BLAST_KNOCKBACK_VELOCITY_Y = -2;

const SUDDEN_DEATH_ROUND_TICKS = 1800; // 30 seconds; the round timer and the warning start point
const SUDDEN_DEATH_WARNING_TICKS = 120; // 2 seconds of flashing markers before the sea rises
const SUDDEN_DEATH_RISE_TICKS = 1200; // 20 seconds for the sea to reach the middle platform
const SUDDEN_DEATH_TARGET_Y = 72; // middle platform top
const SUDDEN_DEATH_RISE_PER_TICK = (WATER_LINE_Y - SUDDEN_DEATH_TARGET_Y) / SUDDEN_DEATH_RISE_TICKS;

// A crate lands this many ticks after the previous one was taken (or lost to the rising sea).
// The crate itself spends the last CRATE_WARNING_TICKS of that window showing its warning marker.
const CRATE_RESPAWN_TICKS = 180;
const CRATE_SPAWN_DELAY_TICKS = CRATE_RESPAWN_TICKS - CRATE_WARNING_TICKS;

export class VersusScene {
  constructor({ startInFightPhase = false, seed = Date.now() } = {}) {
    this.events = new EventEmitter();
    this.random = new SeededRandom(seed);
    this.entityGroups = new EntityGroups();
    for (const layout of PLATFORM_LAYOUTS) this.entityGroups.add('platforms', new Platform(layout));

    this.waterLineY = WATER_LINE_Y;
    this.backgroundDrawn = false;
    this.wins = {};
    for (const spawn of PLAYER_SPAWNS) this.wins[spawn.id] = 0;
    this.skipNextReadyPhase = startInFightPhase;
    this.bumpingPairIds = new Set();
    this.stompingPairIds = new Set();
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
    this.entityGroups.clear('players');
    this.entityGroups.clear('rockets');
    for (const spawn of PLAYER_SPAWNS) this.entityGroups.add('players', new Player(spawn));
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
    this.bumpingPairIds.clear();
    this.stompingPairIds.clear();
    this.waterLineY = WATER_LINE_Y;
    this.fightTicks = 0;
    this.suddenDeathPhase = 'none';
  }

  update(inputByPlayerId) {
    this.ticksRemaining--;
    switch (this.phase) {
      case 'ready':
        if (this.ticksRemaining <= 0) {
          this.phase = 'fight';
          this.ticksRemaining = GO_TICKS;
        }
        break;
      case 'fight':
        this.fightTicks++;
        this.updateSuddenDeath();
        this.updatePlayers(inputByPlayerId);
        this.updateRockets();
        this.updateBouncePads();
        this.updateCrates();
        this.checkRoundEnd();
        break;
      case 'point':
        this.updatePlayers(null);
        this.updateRockets();
        if (this.ticksRemaining <= 0) this.startRound();
        break;
      case 'match':
        this.updatePlayers(null);
        this.updateRockets();
        if (this.ticksRemaining <= 0 && Object.values(inputByPlayerId).some((input) => input.jump)) {
          for (const id in this.wins) this.wins[id] = 0;
          this.startRound();
        }
        break;
    }
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
      this.waterLineY = Math.max(SUDDEN_DEATH_TARGET_Y, this.waterLineY - SUDDEN_DEATH_RISE_PER_TICK);
    }
  }

  updatePlayers(inputByPlayerId) {
    const platforms = this.entityGroups.get('platforms');
    for (const player of this.players) {
      player.update(inputByPlayerId ? inputByPlayerId[player.id] : null, platforms);
      if (player.playedCardName) {
        this.events.emit('card-played', { playerId: player.id, cardName: player.playedCardName });
        if (player.playedCardName === 'rocket') this.spawnRocket(player);
        if (player.playedCardName === 'bouncePad') this.spawnBouncePad(player);
      }
      if (!player.inWater && player.y + player.height >= this.waterLineY) {
        player.startSinking();
        this.events.emit('player-fell-in-water', { playerId: player.id });
      }
      this.wrapPlayerAroundScreen(player);
    }
    this.resolvePlayerCollisions();
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
      this.wrapAroundScreen(rocket);
      if (rocket.exploded) this.resolveRocketExplosion(rocket);
    }
  }

  resolveRocketExplosion(rocket) {
    const blastCenterX = rocket.x + rocket.width / 2;
    const blastCenterY = rocket.y + rocket.height / 2;
    for (const player of this.players) {
      if (player.inWater) continue;
      const distanceX = player.x + player.width / 2 - blastCenterX;
      const distanceY = player.y + player.height / 2 - blastCenterY;
      const distance = Math.hypot(distanceX, distanceY);
      if (distance > BLAST_RADIUS) continue;

      const knockbackDirectionX = distance === 0 ? 1 : distanceX / distance;
      player.applyKnockback(knockbackDirectionX * BLAST_KNOCKBACK_VELOCITY_X, BLAST_KNOCKBACK_VELOCITY_Y);
    }

    this.events.emit('rocket-exploded', { x: blastCenterX, y: blastCenterY });
    this.entityGroups.remove('rockets', rocket);
  }

  // Placed under the player's feet wherever they are, even in midair over the sea, so it doubles
  // as a rescue move. Anyone already standing on that spot is launched immediately.
  spawnBouncePad(player) {
    const x = player.x + player.width / 2 - BOUNCE_PAD_WIDTH / 2;
    const y = player.y + player.height - BOUNCE_PAD_HEIGHT;
    const bouncePad = new BouncePad({ x, y });
    this.entityGroups.add('bouncePads', bouncePad);
    for (const otherPlayer of this.players) {
      if (!otherPlayer.inWater && otherPlayer.overlaps(bouncePad)) otherPlayer.launchUpward(BOUNCE_PAD_LAUNCH_VELOCITY);
    }
  }

  updateBouncePads() {
    for (const bouncePad of this.entityGroups.get('bouncePads')) {
      bouncePad.update();
      if (bouncePad.expired) {
        this.entityGroups.remove('bouncePads', bouncePad);
        continue;
      }
      for (const player of this.players) {
        if (!player.inWater && this.isLandingOnBouncePad(player, bouncePad)) {
          player.launchUpward(BOUNCE_PAD_LAUNCH_VELOCITY);
        }
      }
    }
  }

  // Only a fall that crosses the pad's top surface this tick counts as landing on it, the way a
  // stomp is detected. Walking into its side never crosses that surface, so it does nothing.
  isLandingOnBouncePad(player, bouncePad) {
    if (player.velocityY <= 0) return false;
    const previousFeetY = player.previousY + player.height;
    const feetY = player.y + player.height;
    if (previousFeetY > bouncePad.y || feetY <= bouncePad.y) return false;
    return player.x + player.width > bouncePad.x && player.x < bouncePad.x + bouncePad.width;
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
    this.checkCratePickup(crate);
  }

  // The landing spot and the card both come from the scene's seeded random, so the same seed
  // always drops the same crates in the same places.
  spawnCrate() {
    const platforms = this.entityGroups.get('platforms').filter((platform) => platform.y < this.waterLineY);
    if (platforms.length === 0) return; // no dry platform right now; try again next tick

    const platform = platforms[Math.floor(this.random.next() * platforms.length)];
    const cardName = CARD_NAMES[Math.floor(this.random.next() * CARD_NAMES.length)];
    const x = platform.x + this.random.next() * (platform.width - CRATE_WIDTH);
    const y = platform.y - CRATE_HEIGHT;
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

  // Only snaps once the entity has fully left the screen; its render draws the crossing itself.
  wrapAroundScreen(entity) {
    if (entity.x + entity.width < 0) entity.x += SCREEN_WIDTH;
    else if (entity.x > SCREEN_WIDTH) entity.x -= SCREEN_WIDTH;
    else return false;
    return true;
  }

  wrapPlayerAroundScreen(player) {
    if (!this.wrapAroundScreen(player)) return;
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

  resolvePlayerPair(playerA, playerB) {
    const pairId = [playerA.id, playerB.id].sort().join('-');
    const inWater = playerA.inWater || playerB.inWater;

    const stomp = !inWater && this.detectStomp(playerA, playerB);
    if (stomp) {
      if (!this.stompingPairIds.has(pairId)) {
        this.stompingPairIds.add(pairId);
        this.resolveStomp(stomp.stomper, stomp.stomped);
      }
      this.bumpingPairIds.delete(pairId);
      return;
    }
    this.stompingPairIds.delete(pairId);

    const overlapping = !inWater && this.playersAreBumping(playerA, playerB, 0);
    const stillInContact = !inWater && this.playersAreBumping(playerA, playerB, BUMP_CONTACT_GAP);

    if (overlapping) {
      const leftPlayer = playerA.x <= playerB.x ? playerA : playerB;
      const rightPlayer = leftPlayer === playerA ? playerB : playerA;
      const overlapX = leftPlayer.x + leftPlayer.width - rightPlayer.x;
      const pushApart = overlapX / 2;
      leftPlayer.x -= pushApart;
      rightPlayer.x += pushApart;

      // Knockback fires only when the contact starts. Adding it on every overlapping tick made
      // held-together players buzz: each push added more velocity, bouncing them apart and back in.
      if (!this.bumpingPairIds.has(pairId)) {
        this.bumpingPairIds.add(pairId);
        const isDashHit = playerA.dashTicksRemaining > 0 || playerB.dashTicksRemaining > 0;
        const knockbackVelocityX = isDashHit ? DASH_KNOCKBACK_VELOCITY_X : BUMP_KNOCKBACK_VELOCITY_X;
        leftPlayer.applyKnockback(-knockbackVelocityX, 0);
        rightPlayer.applyKnockback(knockbackVelocityX, 0);
        this.events.emit('players-bumped', { playerIds: [playerA.id, playerB.id] });
      }
    }

    if (!stillInContact) this.bumpingPairIds.delete(pairId);
  }

  // A player whose feet are clearly above the other's head is jumping over them, not bumping into them.
  // horizontalPadding widens the gap that still counts as touching, so a bump kept apart by a few pixels
  // is still the same contact instead of a fresh one.
  playersAreBumping(playerA, playerB, horizontalPadding) {
    const higherPlayer = playerA.y < playerB.y ? playerA : playerB;
    const lowerPlayer = higherPlayer === playerA ? playerB : playerA;
    if (higherPlayer.y + higherPlayer.height <= lowerPlayer.y + BUMP_HEAD_CLEARANCE) return false;

    const leftPlayer = playerA.x <= playerB.x ? playerA : playerB;
    const rightPlayer = leftPlayer === playerA ? playerB : playerA;
    return leftPlayer.x + leftPlayer.width + horizontalPadding > rightPlayer.x;
  }

  detectStomp(playerA, playerB) {
    const leftPlayer = playerA.x <= playerB.x ? playerA : playerB;
    const rightPlayer = leftPlayer === playerA ? playerB : playerA;
    if (leftPlayer.x + leftPlayer.width <= rightPlayer.x) return null;

    if (this.isStompingHead(playerA, playerB)) return { stomper: playerA, stomped: playerB };
    if (this.isStompingHead(playerB, playerA)) return { stomper: playerB, stomped: playerA };
    return null;
  }

  // A fast fall can cross the whole head band in a single tick, so a snapshot check can miss it.
  // Detect the crossing instead: the stomper's feet were at or above the target's head before
  // moving this tick, and are below it now.
  isStompingHead(stomper, target) {
    if (stomper.velocityY <= 0) return false;
    const previousFeetY = stomper.previousY + stomper.height;
    const feetY = stomper.y + stomper.height;
    return previousFeetY <= target.y && feetY > target.y;
  }

  resolveStomp(stomper, stomped) {
    stomper.bounceFromStomp();
    stomper.refreshAirJump();

    const stomperCenterX = stomper.x + stomper.width / 2;
    const stompedCenterX = stomped.x + stomped.width / 2;
    const knockbackDirection = stompedCenterX >= stomperCenterX ? 1 : -1;
    stomped.applyKnockback(knockbackDirection * STOMP_KNOCKBACK_VELOCITY_X, STOMP_KNOCKBACK_VELOCITY_Y);
    stomped.makeDizzy(DIZZY_TICKS);

    this.events.emit('player-stomped', { stomperId: stomper.id, stompedId: stomped.id });
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

  render(renderer) {
    if (!this.backgroundDrawn) {
      renderer.updateBackground((context) =>
        drawBackground(context, renderer.backgroundCanvas.width, renderer.backgroundCanvas.height),
      );
      this.backgroundDrawn = true;
    }

    renderer.clearGameLayer();
    this.entityGroups.renderAll(renderer.gameContext);

    renderer.clearUiLayer();
    drawHud(renderer.uiContext, this);
  }
}
