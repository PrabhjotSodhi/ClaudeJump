import {
  HILL_RESPAWN_TICKS,
  HILL_ROUND_TICKS,
  HILL_ZONE_HEIGHT,
  HILL_ZONE_MOVE_TICKS,
  HILL_ZONE_WIDTH,
} from '../engine/config.js';

// Platform tops narrower than this only hold the zone when there is nothing wider.
const MINIMUM_ZONE_TOP_WIDTH = 32;

function zoneOn(openTop) {
  const width = Math.min(HILL_ZONE_WIDTH, openTop.width);
  return {
    x: openTop.x + Math.floor((openTop.width - width) / 2),
    y: openTop.y - HILL_ZONE_HEIGHT,
    width,
    height: HILL_ZONE_HEIGHT,
  };
}

function sameZone(first, second) {
  return first.x === second.x && first.y === second.y;
}

// The rules of a Hold the hill round, run by the Versus scene. A zone sits on a platform and moves every
// HILL_ZONE_MOVE_TICKS to where its marker shows. A player alone in it scores a point a tick, knocked out players
// come back after HILL_RESPAWN_TICKS, and the most points when the time runs out wins the round.
// Everything here is plain data, so the state hash covers it.
export class HoldTheHill {
  constructor() {
    this.zone = null;
    this.nextZone = null;
    this.ticksUntilMove = 0;
    // The one player in the zone this tick, or null when it is empty or contested.
    this.holderId = null;
    this.contested = false;
    this.pointsByPlayerId = {};
    this.ticksInWaterByPlayerId = {};
  }

  startRound(scene) {
    this.pointsByPlayerId = {};
    this.ticksInWaterByPlayerId = {};
    for (const player of scene.players) {
      this.pointsByPlayerId[player.id] = 0;
      this.ticksInWaterByPlayerId[player.id] = 0;
    }
    this.zone = this.pickZone(scene, null);
    this.nextZone = this.pickZone(scene, this.zone);
    this.ticksUntilMove = HILL_ZONE_MOVE_TICKS;
    this.holderId = null;
    this.contested = false;
  }

  // A random dry platform top other than `currentZone`'s, wide ones first.
  pickZone(scene, currentZone) {
    const dryTops = scene.openTops.filter((openTop) => openTop.y < scene.waterLineY);
    const wideTops = dryTops.filter((openTop) => openTop.width >= MINIMUM_ZONE_TOP_WIDTH);
    const tops = wideTops.length > 0 ? wideTops : dryTops;
    const zones = tops.map(zoneOn);
    const otherZones = currentZone ? zones.filter((zone) => !sameZone(zone, currentZone)) : zones;
    const choices = otherZones.length > 0 ? otherZones : zones;
    return choices[Math.floor(scene.random.next() * choices.length)];
  }

  update(scene) {
    this.ticksUntilMove--;
    if (this.ticksUntilMove <= 0) {
      this.zone = this.nextZone;
      this.nextZone = this.pickZone(scene, this.zone);
      this.ticksUntilMove = HILL_ZONE_MOVE_TICKS;
      scene.events.emit('hill-moved', { x: this.zone.x + this.zone.width / 2, y: this.zone.y + this.zone.height });
    }

    const playersInZone = scene.players.filter((player) => !player.inWater && player.overlaps(this.zone));
    this.contested = playersInZone.length > 1;
    this.holderId = playersInZone.length === 1 ? playersInZone[0].id : null;
    if (this.holderId) this.pointsByPlayerId[this.holderId]++;

    for (const player of scene.players) {
      if (!player.inWater) continue;
      this.ticksInWaterByPlayerId[player.id]++;
      if (this.ticksInWaterByPlayerId[player.id] < HILL_RESPAWN_TICKS) continue;
      this.ticksInWaterByPlayerId[player.id] = 0;
      scene.respawnPlayer(player);
    }
  }

  // The round timer runs for this long, then the round ends on points instead of a rising sea.
  get roundTicks() {
    return HILL_ROUND_TICKS;
  }

  // The player with the most points, or null when nobody scored or the lead is tied.
  winnerId() {
    const points = Object.values(this.pointsByPlayerId);
    const most = Math.max(...points);
    if (most === 0 || points.filter((value) => value === most).length > 1) return null;
    return Object.keys(this.pointsByPlayerId).find((playerId) => this.pointsByPlayerId[playerId] === most);
  }
}
