// A white flash and a ring of sparks where two shoves clash, the sparks in the two players' colors. Display only:
// it reacts to the shove-clash event and works out every frame from the age in ticks, so it never changes game
// state and throws the same sparks for the same events.
import { flashStrength } from '../engine/sound-settings.js';

const FLASH_TICKS = 6;
const SPARK_TICKS = 16;
const SPARK_COUNT = 10;
const SPARK_SPEED = 2.5;
const SPARK_SIZE = 2;
const FLASH_COLOR = '#ffffff';
const FLASH_RADIUS = 10;

export class ClashSparks {
  constructor() {
    this.clashes = [];
  }

  attach(events, getPlayers, getTickCount) {
    events.on('shove-clash', ({ x, y, playerIds }) => {
      const colors = playerIds.map((playerId) => getPlayers().find((candidate) => candidate.id === playerId)?.color);
      this.clashes.push({ x, y, colors, spawnTick: getTickCount() });
    });
  }

  // Also drops clashes that have finished, so the list never grows unbounded.
  activeClashes(currentTick) {
    this.clashes = this.clashes.filter((clash) => currentTick - clash.spawnTick < SPARK_TICKS);
    return this.clashes;
  }
}

export function drawClashSparks(context, scene) {
  for (const clash of scene.clashSparks.activeClashes(scene.tickCount)) {
    const age = scene.tickCount - clash.spawnTick;
    if (age < FLASH_TICKS) {
      const radius = Math.round(FLASH_RADIUS * (1 - age / FLASH_TICKS));
      context.fillStyle = FLASH_COLOR;
      context.globalAlpha = flashStrength();
      context.fillRect(Math.round(clash.x) - radius, Math.round(clash.y) - 1, 2 * radius, 2);
      context.fillRect(Math.round(clash.x) - 1, Math.round(clash.y) - radius, 2, 2 * radius);
      context.globalAlpha = 1;
    }
    context.globalAlpha = 1 - age / SPARK_TICKS;
    for (let index = 0; index < SPARK_COUNT; index++) {
      const angle = ((index + 0.5) / SPARK_COUNT) * 2 * Math.PI;
      const distance = SPARK_SPEED * age;
      context.fillStyle = clash.colors[index % clash.colors.length] ?? FLASH_COLOR;
      context.fillRect(
        Math.round(clash.x + Math.cos(angle) * distance),
        Math.round(clash.y + Math.sin(angle) * distance),
        SPARK_SIZE,
        SPARK_SIZE,
      );
    }
  }
  context.globalAlpha = 1;
}
