// 5x5 bitmap font, drawn pixel by pixel so text stays as crisp as the art.
// Empty columns are trimmed, so narrow glyphs like I and ! take less space.
const GLYPHS = {
  A: '.###. #...# ##### #...# #...#',
  B: '####. #...# ####. #...# ####.',
  C: '.#### #.... #.... #.... .####',
  D: '####. #...# #...# #...# ####.',
  E: '##### #.... ####. #.... #####',
  F: '##### #.... ####. #.... #....',
  G: '.#### #.... #.### #...# .####',
  H: '#...# #...# ##### #...# #...#',
  I: '### .#. .#. .#. ###',
  J: '..### ...#. ...#. #..#. .##..',
  K: '#...# #..#. ###.. #..#. #...#',
  L: '#.... #.... #.... #.... #####',
  M: '#...# ##.## #.#.# #...# #...#',
  N: '#...# ##..# #.#.# #..## #...#',
  O: '.###. #...# #...# #...# .###.',
  P: '####. #...# ####. #.... #....',
  Q: '.###. #...# #.#.# #..#. .##.#',
  R: '####. #...# ####. #..#. #...#',
  S: '.#### #.... .###. ....# ####.',
  T: '##### ..#.. ..#.. ..#.. ..#..',
  U: '#...# #...# #...# #...# .###.',
  V: '#...# #...# #...# .#.#. ..#..',
  W: '#...# #...# #.#.# ##.## #...#',
  X: '#...# .#.#. ..#.. .#.#. #...#',
  Y: '#...# .#.#. ..#.. ..#.. ..#..',
  Z: '##### ...#. ..#.. .#... #####',
  0: '.###. #..## #.#.# ##..# .###.',
  1: '.#. ##. .#. .#. ###',
  2: '####. ....# .###. #.... #####',
  3: '####. ....# .###. ....# ####.',
  4: '#...# #...# ##### ....# ....#',
  5: '##### #.... ####. ....# ####.',
  6: '.###. #.... ####. #...# .###.',
  7: '##### ....# ...#. ..#.. ..#..',
  8: '.###. #...# .###. #...# .###.',
  9: '.###. #...# .#### ....# .###.',
  '!': '# # # . #',
  '.': '. . . . #',
  ':': '. # . # .',
};
const SPACE_WIDTH = 3;
const GLYPH_GAP = 1;
export const TEXT_GLYPH_HEIGHT = 10;
// drawText outlines each glyph by one pixel on every side, including above and below.
export const TEXT_OUTLINE_MARGIN = 2;
const glyphCanvasCache = new Map();

function glyphCanvas(character, color) {
  const cacheKey = character + color;
  if (glyphCanvasCache.has(cacheKey)) return glyphCanvasCache.get(cacheKey);

  const rows = GLYPHS[character].split(' ');
  const canvas = document.createElement('canvas');
  canvas.width = rows[0].length;
  canvas.height = rows.length;
  const context = canvas.getContext('2d');
  context.fillStyle = color;
  rows.forEach((row, y) => [...row].forEach((cell, x) => cell === '#' && context.fillRect(x, y, 1, 1)));

  glyphCanvasCache.set(cacheKey, canvas);
  return canvas;
}

// Width in pixels of text drawn at scale 1.
export function measureText(text) {
  let width = 0;
  for (const character of text.toUpperCase())
    width += (character in GLYPHS ? GLYPHS[character].split(' ')[0].length : SPACE_WIDTH) + GLYPH_GAP;
  return Math.max(0, width - GLYPH_GAP);
}

function drawRun(context, text, x, y, scale, color) {
  for (const character of text) {
    if (!(character in GLYPHS)) {
      x += (SPACE_WIDTH + GLYPH_GAP) * scale;
      continue;
    }
    const canvas = glyphCanvas(character, color);
    context.drawImage(canvas, x, y, canvas.width * scale, canvas.height * scale);
    x += (canvas.width + GLYPH_GAP) * scale;
  }
}

export function drawText(
  context,
  text,
  x,
  y,
  { scale = 2, align = 'left', color = '#fff', outlineColor = '#141428' } = {},
) {
  text = text.toUpperCase();
  context.imageSmoothingEnabled = false;
  const width = measureText(text) * scale;
  if (align === 'center') x -= Math.floor(width / 2);
  if (align === 'right') x -= width;

  if (outlineColor) {
    for (const [offsetX, offsetY] of [
      [-2, 0],
      [2, 0],
      [0, -2],
      [0, 2],
      [-2, -2],
      [2, -2],
      [-2, 2],
      [2, 2],
    ]) {
      drawRun(context, text, x + offsetX, y + offsetY, scale, outlineColor);
    }
  }
  drawRun(context, text, x, y, scale, color);
}
