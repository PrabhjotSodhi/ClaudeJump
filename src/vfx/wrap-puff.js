import { PLAYER_HEIGHT, PLAYER_WIDTH } from '../entities/player.js';

// Marks where a player re-enters the screen after a screen wrap, in that player's color.
// Timed in ticks, not rendered frames, so it lasts the same real time regardless of the
// screen's refresh rate. Never read by game logic, and never changes it: it only reacts to
// the player-wrapped event.
const FADE_TICKS = 18; // about 0.3 seconds at 60 ticks per second
// A hollow ring, clearly bigger than the 8x12 player, so it reads as a puff around them
// instead of a block sitting on top of them.
const PUFF_WIDTH = PLAYER_WIDTH + 8;
const PUFF_HEIGHT = PLAYER_HEIGHT + 8;
const PUFF_RING_THICKNESS = 3;

export class WrapPuffTracker {
  constructor() {
    this.puffs = [];
  }

  attach(events, getPlayers, getTickCount) {
    events.on('player-wrapped', ({ playerId, x, y }) => {
      const player = getPlayers().find((candidate) => candidate.id === playerId);
      if (player) this.puffs.push({ x, y, color: player.color, spawnTick: getTickCount() });
    });
  }

  // Also drops puffs whose fade has finished, so the list never grows unbounded.
  activePuffs(currentTick) {
    this.puffs = this.puffs.filter((puff) => currentTick - puff.spawnTick < FADE_TICKS);
    return this.puffs;
  }
}

function drawRing(context, x, y) {
  context.fillRect(x, y, PUFF_WIDTH, PUFF_RING_THICKNESS);
  context.fillRect(x, y + PUFF_HEIGHT - PUFF_RING_THICKNESS, PUFF_WIDTH, PUFF_RING_THICKNESS);
  context.fillRect(x, y + PUFF_RING_THICKNESS, PUFF_RING_THICKNESS, PUFF_HEIGHT - 2 * PUFF_RING_THICKNESS);
  context.fillRect(
    x + PUFF_WIDTH - PUFF_RING_THICKNESS,
    y + PUFF_RING_THICKNESS,
    PUFF_RING_THICKNESS,
    PUFF_HEIGHT - 2 * PUFF_RING_THICKNESS,
  );
}

// Drawn on the game layer, before the entities, so the player renders on top of it instead of
// the puff hiding them the moment they wrap.
export function drawWrapPuffs(context, scene) {
  for (const puff of scene.wrapPuffTracker.activePuffs(scene.tickCount)) {
    const age = scene.tickCount - puff.spawnTick;
    context.globalAlpha = 1 - age / FADE_TICKS;
    context.fillStyle = puff.color;
    const drawX = Math.round(puff.x + PLAYER_WIDTH / 2 - PUFF_WIDTH / 2);
    const drawY = Math.round(puff.y + PLAYER_HEIGHT / 2 - PUFF_HEIGHT / 2);
    drawRing(context, drawX, drawY);
  }
  context.globalAlpha = 1;
}

export const WRAP_PUFF_FADE_TICKS = FADE_TICKS;
