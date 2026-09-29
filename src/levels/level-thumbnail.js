import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { drawArenaBackground } from './versus-arena.js';

// Each thumbnail pixel is one point sampled from a square of screen pixels this wide, so the thumbnail
// stays pixel art made of palette colors.
const THUMBNAIL_SCALE_DOWN = 4;
export const THUMBNAIL_WIDTH = SCREEN_WIDTH / THUMBNAIL_SCALE_DOWN;
export const THUMBNAIL_HEIGHT = SCREEN_HEIGHT / THUMBNAIL_SCALE_DOWN;

// The shader draws the real sea, so the thumbnail stands in a flat one at the level's water line.
const SEA_COLOR = '#124e89';
const SEA_SURFACE_COLOR = '#0099db';
const SEA_SURFACE_HEIGHT = THUMBNAIL_SCALE_DOWN;

function createCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// Draws the level the way a match does, then shrinks it, so a new level file gets a thumbnail with no extra art.
export function createLevelThumbnail(level) {
  const fullSizeCanvas = createCanvas(SCREEN_WIDTH, SCREEN_HEIGHT);
  const fullSizeContext = fullSizeCanvas.getContext('2d');
  drawArenaBackground(fullSizeContext, level.background);
  for (const tile of level.tiles) fullSizeContext.drawImage(level.tileSprites[tile.name], tile.x, tile.y);
  fullSizeContext.fillStyle = SEA_SURFACE_COLOR;
  fullSizeContext.fillRect(0, level.waterLineY, SCREEN_WIDTH, SEA_SURFACE_HEIGHT);
  fullSizeContext.fillStyle = SEA_COLOR;
  fullSizeContext.fillRect(0, level.waterLineY + SEA_SURFACE_HEIGHT, SCREEN_WIDTH, SCREEN_HEIGHT);

  const thumbnail = createCanvas(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
  const thumbnailContext = thumbnail.getContext('2d');
  thumbnailContext.imageSmoothingEnabled = false;
  thumbnailContext.drawImage(fullSizeCanvas, 0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
  return thumbnail;
}
