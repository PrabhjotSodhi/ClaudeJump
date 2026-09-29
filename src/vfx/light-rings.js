const LEVEL_SHADE_STEP = 85;
const FULL_LIGHT_LEVEL = 2;
const DITHER_WIDTH = 2;

let maskCanvas = null;

function levelColor(level) {
  return `rgb(${level * LEVEL_SHADE_STEP}, 0, 0)`;
}

function halfWidthAt(radius, offsetY) {
  return Math.abs(offsetY) > radius ? -1 : Math.round(Math.sqrt(radius * radius - offsetY * offsetY));
}

// A solid disc with a checkered rim, so the edge of a light softens instead of cutting a hard circle.
function fillDisc(context, centerX, centerY, radius) {
  const outerRadius = radius + DITHER_WIDTH;
  for (let offsetY = -outerRadius; offsetY <= outerRadius; offsetY++) {
    const solidHalfWidth = halfWidthAt(radius, offsetY);
    const outerHalfWidth = halfWidthAt(outerRadius, offsetY);
    if (solidHalfWidth >= 0) context.fillRect(centerX - solidHalfWidth, centerY + offsetY, solidHalfWidth * 2 + 1, 1);
    for (let offsetX = solidHalfWidth + 1; offsetX <= outerHalfWidth; offsetX++) {
      if ((offsetX + offsetY) % 2 !== 0) continue;
      context.fillRect(centerX + offsetX, centerY + offsetY, 1, 1);
      context.fillRect(centerX - offsetX, centerY + offsetY, 1, 1);
    }
  }
}

// Light levels live in the red channel as level * 85: 0 is unlit, 2 is full light. Overlapping lights keep the brighter level.
// radii runs from the outer ring (level 1) to the inner ring (level 2). Each ring breathes on its own phase.
export function drawLightRings(context, centerX, centerY, radii, tickCount) {
  context.save();
  context.globalCompositeOperation = 'lighten';
  radii.forEach((radius, ringIndex) => {
    const breath = Math.round(Math.sin(tickCount * 0.05 + ringIndex * 0.8) * 2);
    context.fillStyle = levelColor(ringIndex + 1);
    fillDisc(context, centerX, centerY, radius + breath);
  });
  context.restore();
}

// Lights every opaque pixel of image fully, so a character keeps its true colors in the dark.
export function drawFullyLit(context, image, x, y) {
  maskCanvas ??= document.createElement('canvas');
  maskCanvas.width = image.width;
  maskCanvas.height = image.height;
  const maskContext = maskCanvas.getContext('2d');
  maskContext.drawImage(image, 0, 0);
  maskContext.globalCompositeOperation = 'source-in';
  maskContext.fillStyle = levelColor(FULL_LIGHT_LEVEL);
  maskContext.fillRect(0, 0, image.width, image.height);
  context.save();
  context.globalCompositeOperation = 'lighten';
  context.drawImage(maskCanvas, x, y);
  context.restore();
}
