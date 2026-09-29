import { drawGooglyEye, EYE_SIZE } from './googly-eyes.js';

// Every character sprite is drawn in a square frame this big. Its last row is the white outline.
export const FRAME_SIZE = 32;

// centerX is the middle of the frame and bottomY the row just under it. width and height are the squashed size in
// whole pixels. Eyes keep their size and ride on the squashed body, measured from the bottom center of the frame.
export function drawCharacterBody(context, { sprite, eyeFramePositions, eyes, centerX, bottomY, width, height }) {
  context.imageSmoothingEnabled = false;
  context.drawImage(sprite, centerX - Math.floor(width / 2), bottomY - height, width, height);
  const scaleX = width / FRAME_SIZE;
  const scaleY = height / FRAME_SIZE;
  eyeFramePositions.forEach(([frameX, frameY], index) => {
    const eyeCenterX = centerX + (frameX + EYE_SIZE / 2 - FRAME_SIZE / 2) * scaleX;
    const eyeCenterY = bottomY + (frameY + EYE_SIZE / 2 - FRAME_SIZE) * scaleY;
    drawGooglyEye(context, eyes[index], Math.round(eyeCenterX - EYE_SIZE / 2), Math.round(eyeCenterY - EYE_SIZE / 2));
  });
}
