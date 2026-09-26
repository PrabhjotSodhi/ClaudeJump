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
    this.startRound();
  }

  get players() {
    return this.entityGroups.get('players');
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

  updatePlayers(inputByPlayerId) {
    const platforms = this.entityGroups.get('platforms');
    for (const player of this.players) {
      player.update(inputByPlayerId ? inputByPlayerId[player.id] : null, platforms);
      if (!player.inWater && player.y > this.waterLineY) {
        player.startSinking();
        this.events.emit('player-fell-in-water', { playerId: player.id });
      }
    }
    this.resolvePlayerCollisions();
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
    const overlapping = !inWater && this.playersAreBumping(playerA, playerB, 0);
    const stillInContact = !inWater && this.playersAreBumping(playerA, playerB, BUMP_CONTACT_GAP);

    if (overlapping) {
      const leftPlayer = playerA.x <= playerB.x ? playerA : playerB;
      const rightPlayer = leftPlayer === playerA ? playerB : playerA;
      const overlapX = leftPlayer.x + leftPlayer.width - rightPlayer.x;
      const pushApart = overlapX / 2;
      leftPlayer.x -= pushApart;
      rightPlayer.x += pushApart;
      leftPlayer.applyKnockback(-BUMP_KNOCKBACK_VELOCITY_X, 0);
      rightPlayer.applyKnockback(BUMP_KNOCKBACK_VELOCITY_X, 0);

      if (!this.bumpingPairIds.has(pairId)) {
        this.bumpingPairIds.add(pairId);
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
