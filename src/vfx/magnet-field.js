// Display only: while a magnet pulls, dots in the puller's color stream from each pulled player toward them.
const DOTS_PER_LINE = 3;
const DOT_SIZE = 2;
const DOT_TRAVEL_TICKS = 18;

function centerOf(player) {
  return { x: player.x + player.width / 2, y: player.y + player.height / 2 };
}

export function drawMagnetField(context, scene) {
  for (const puller of scene.players) {
    if (puller.magnetTicksRemaining <= 0 || puller.inWater) continue;
    const to = centerOf(puller);
    context.fillStyle = puller.color;
    for (const target of scene.players) {
      if (target === puller || target.inWater) continue;
      const from = centerOf(target);
      for (let dot = 0; dot < DOTS_PER_LINE; dot++) {
        const progress = ((scene.tickCount / DOT_TRAVEL_TICKS + dot / DOTS_PER_LINE) % 1) * 0.8 + 0.1;
        const x = Math.round(from.x + (to.x - from.x) * progress - DOT_SIZE / 2);
        const y = Math.round(from.y + (to.y - from.y) * progress - DOT_SIZE / 2);
        context.fillRect(x, y, DOT_SIZE, DOT_SIZE);
      }
    }
  }
}
