import { BOMB_FUSE_MAX_TICKS, BOMB_FUSE_MIN_TICKS, BOMB_PASS_BACK_TICKS } from '../engine/config.js';

// The rules of a Pass the bomb round, run by the Versus scene. One player holds a lit bomb and passes it by touching
// someone else. When the fuse runs out the holder is blown out of the round and a new bomb goes to a random player
// still standing. The last player standing wins, as in Knockout. Everything here is plain data, so the state hash
// covers it.
export class PassTheBomb {
  constructor() {
    this.holderId = null;
    this.fuseTicks = 0;
    this.fuseTicksRemaining = 0;
    this.lastPasserId = null;
    this.passBackTicksRemaining = 0;
  }

  startRound(scene) {
    this.handToRandomPlayer(scene);
  }

  // Every draw comes from the scene's seeded random, so every device hands the bomb to the same player.
  handToRandomPlayer(scene) {
    const standing = scene.players.filter((player) => !player.inWater);
    this.lastPasserId = null;
    this.passBackTicksRemaining = 0;
    if (standing.length < 2) {
      this.holderId = null;
      return;
    }
    this.holderId = standing[Math.floor(scene.random.next() * standing.length)].id;
    this.fuseTicks =
      BOMB_FUSE_MIN_TICKS + Math.floor(scene.random.next() * (BOMB_FUSE_MAX_TICKS - BOMB_FUSE_MIN_TICKS + 1));
    this.fuseTicksRemaining = this.fuseTicks;
    scene.events.emit('bomb-handed', { playerId: this.holderId });
  }

  update(scene) {
    if (!this.holderId) return;
    const holder = scene.players.find((player) => player.id === this.holderId);
    if (holder.inWater) {
      this.handToRandomPlayer(scene);
      return;
    }

    if (this.passBackTicksRemaining > 0) this.passBackTicksRemaining--;
    const receiver = scene.players.find(
      (player) =>
        player !== holder &&
        !player.inWater &&
        !(player.id === this.lastPasserId && this.passBackTicksRemaining > 0) &&
        player.overlaps(holder),
    );
    if (receiver) {
      this.lastPasserId = holder.id;
      this.passBackTicksRemaining = BOMB_PASS_BACK_TICKS;
      this.holderId = receiver.id;
      scene.events.emit('bomb-passed', { fromId: holder.id, toId: receiver.id });
    }

    this.fuseTicksRemaining--;
    if (this.fuseTicksRemaining > 0) return;
    const blownUp = scene.players.find((player) => player.id === this.holderId);
    scene.blowUpPlayer(blownUp);
    this.handToRandomPlayer(scene);
  }
}
