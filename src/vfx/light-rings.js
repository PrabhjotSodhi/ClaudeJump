const LEVEL_SHADE_STEP = 85;

function fillDisc(context, centerX, centerY, radius) {
  for (let offsetY = -radius; offsetY <= radius; offsetY++) {
    const halfWidth = Math.round(Math.sqrt(radius * radius - offsetY * offsetY));
    context.fillRect(centerX - halfWidth, centerY + offsetY, halfWidth * 2 + 1, 1);
  }
}

// Light levels live in the red channel as level * 85, so 0 to 3 maps onto 0 to 255.
// radii runs from the outer ring (level 1) to the inner ring (level 3). Each ring breathes on its own phase.
export function drawLightRings(context, centerX, centerY, radii, tickCount) {
  radii.forEach((radius, ringIndex) => {
    const breath = Math.round(Math.sin(tickCount * 0.05 + ringIndex * 0.8) * 2);
    context.fillStyle = `rgb(${(ringIndex + 1) * LEVEL_SHADE_STEP}, 0, 0)`;
    fillDisc(context, centerX, centerY, radius + breath);
  });
}
