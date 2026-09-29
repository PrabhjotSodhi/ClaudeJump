import { EYE_STIFFNESSES, GooglyEye } from './googly-eyes.js';

// Display only: each player's eyes react to events and to the player's velocity, and game logic never reads them.
export class PlayerEyes {
  constructor() {
    this.eyesByPlayerId = new Map();
    this.getPlayers = () => [];
  }

  attach(events, getPlayers) {
    this.getPlayers = getPlayers;
    events.on('player-jumped', ({ playerId }) => this.jump(playerId));
    events.on('player-shoved', ({ targetId }) => this.hit(targetId));
    events.on('player-burned', ({ playerId }) => this.hit(playerId));
    events.on('player-pinched', ({ playerId }) => this.hit(playerId));
    events.on('trap-sprung', ({ targetId }) => this.hit(targetId));
    events.on('dash-hit', ({ playerIds = [] }) => playerIds.forEach((playerId) => this.hit(playerId)));
    events.on('rocket-exploded', ({ playerIds = [] }) => playerIds.forEach((playerId) => this.hit(playerId)));
    events.on('bomb-exploded', ({ playerIds = [] }) => playerIds.forEach((playerId) => this.hit(playerId)));
  }

  eyesFor(playerId) {
    if (!this.eyesByPlayerId.has(playerId)) {
      this.eyesByPlayerId.set(
        playerId,
        EYE_STIFFNESSES.map((stiffness) => new GooglyEye(stiffness)),
      );
    }
    return this.eyesByPlayerId.get(playerId);
  }

  jump(playerId) {
    for (const eye of this.eyesFor(playerId)) eye.jump();
  }

  // The hit has already pushed the player, so the knockback shows which way the pupils get left behind.
  hit(playerId) {
    const player = this.getPlayers().find((candidate) => candidate.id === playerId);
    if (!player) return;
    for (const eye of this.eyesFor(playerId)) eye.hit(Math.sign(player.knockbackVelocityX));
  }

  update() {
    for (const player of this.getPlayers()) {
      const velocityX = player.velocityX + player.knockbackVelocityX;
      for (const eye of this.eyesFor(player.id)) eye.update(velocityX, player.velocityY);
    }
  }
}
