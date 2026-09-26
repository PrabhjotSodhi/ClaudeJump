import { SCREEN_WIDTH } from '../engine/config.js';
import { EntityGroups } from '../engine/entity-groups.js';
import { EventEmitter } from '../engine/events.js';
import { Platform } from '../entities/platform.js';
import { Player } from '../entities/player.js';
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

const SUDDEN_DEATH_ROUND_TICKS = 1800; // 30 seconds; the round timer and the warning start point
const SUDDEN_DEATH_WARNING_TICKS = 120; // 2 seconds of flashing markers before the sea rises
const SUDDEN_DEATH_RISE_TICKS = 1200; // 20 seconds for the sea to reach the middle platform
const SUDDEN_DEATH_TARGET_Y = 72; // middle platform top
const SUDDEN_DEATH_RISE_PER_TICK = (WATER_LINE_Y - SUDDEN_DEATH_TARGET_Y) / SUDDEN_DEATH_RISE_TICKS;

export class VersusScene {
  constructor({ startInFightPhase = false } = {}) {
    this.events = new EventEmitter();
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
    this.entityGroups.clear('players');
    for (const spawn of PLAYER_SPAWNS) this.entityGroups.add('players', new Player(spawn));
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
        this.checkRoundEnd();
        break;
      case 'point':
        this.updatePlayers(null);
        if (this.ticksRemaining <= 0) this.startRound();
        break;
      case 'match':
        this.updatePlayers(null);
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
      if (!player.inWater && player.y + player.height >= this.waterLineY) {
        player.startSinking();
        this.events.emit('player-fell-in-water', { playerId: player.id });
      }
      this.wrapPlayerAroundScreen(player);
    }
    this.resolvePlayerCollisions();
  }

  // Only snaps once the player has fully left the screen; Player.render draws the crossing itself.
  wrapPlayerAroundScreen(player) {
    if (player.x + player.width < 0) player.x += SCREEN_WIDTH;
    else if (player.x > SCREEN_WIDTH) player.x -= SCREEN_WIDTH;
    else return;

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
        leftPlayer.applyKnockback(-BUMP_KNOCKBACK_VELOCITY_X, 0);
        rightPlayer.applyKnockback(BUMP_KNOCKBACK_VELOCITY_X, 0);
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
