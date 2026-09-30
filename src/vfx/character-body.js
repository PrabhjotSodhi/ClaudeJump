import { flashStrength } from '../engine/sound-settings.js';
import { drawGooglyEye, EYE_SIZE } from './googly-eyes.js';

// Every character sprite is drawn in a square frame this big. Its last row is the white outline.
export const FRAME_SIZE = 32;
const OUTLINE_OFFSETS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const GLOW_OFFSETS = [...OUTLINE_OFFSETS, [-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]];

// flashSprite is an optional all white copy of the body drawn over it before the eyes. outlineSprite is an optional
// one color copy drawn one pixel up, down, left and right behind the body, so it shows as a ring around it.
// glowSprite is the same idea two pixels out, so it shows around the outline ring.
// centerX is the middle of the frame and bottomY the row just under it. width and height are the squashed size in
// whole pixels. Eyes keep their size and ride on the squashed body, measured from the bottom center of the frame.
export function drawCharacterBody(
  context,
  {
    sprite,
    flashSprite = null,
    outlineSprite = null,
    glowSprite = null,
    eyeFramePositions,
    eyes,
    centerX,
    bottomY,
    width,
    height,
  },
) {
  context.imageSmoothingEnabled = false;
  const left = centerX - Math.floor(width / 2);
  const top = bottomY - height;
  if (glowSprite) {
    for (const [offsetX, offsetY] of GLOW_OFFSETS)
      context.drawImage(glowSprite, left + offsetX, top + offsetY, width, height);
  }
  if (outlineSprite) {
    for (const [offsetX, offsetY] of OUTLINE_OFFSETS)
      context.drawImage(outlineSprite, left + offsetX, top + offsetY, width, height);
  }
  context.drawImage(sprite, left, top, width, height);
  if (flashSprite) {
    context.globalAlpha = flashStrength();
    context.drawImage(flashSprite, left, top, width, height);
    context.globalAlpha = 1;
  }
  const scaleX = width / FRAME_SIZE;
  const scaleY = height / FRAME_SIZE;
  eyeFramePositions.forEach(([frameX, frameY], index) => {
    const eyeCenterX = centerX + (frameX + EYE_SIZE / 2 - FRAME_SIZE / 2) * scaleX;
    const eyeCenterY = bottomY + (frameY + EYE_SIZE / 2 - FRAME_SIZE) * scaleY;
    drawGooglyEye(context, eyes[index], Math.round(eyeCenterX - EYE_SIZE / 2), Math.round(eyeCenterY - EYE_SIZE / 2));
  });
}
