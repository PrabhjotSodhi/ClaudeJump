// Pixel art icons for button hints, all 11x11. Pad glyphs show a button by its position on the
// face cluster, never by a letter or a symbol. The pressed position is highlighted.
export const GLYPH_SIZE = 11;

const INACTIVE_COLOR = '#5a6988';
const ACTIVE_COLOR = '#feae34';
const RING_COLOR = '#8b9bb4';
const CENTER_COLOR = '#c0cbdc';

const DOT_CENTERS = { north: [5, 1], west: [1, 5], east: [9, 5], south: [5, 9] };
const DOT_OFFSETS = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function faceButtonGlyph(activePosition) {
  const rows = Array.from({ length: GLYPH_SIZE }, () => Array(GLYPH_SIZE).fill('.'));
  for (const [position, [centerX, centerY]] of Object.entries(DOT_CENTERS)) {
    const mark = position === activePosition ? 'x' : 'o';
    for (const [offsetX, offsetY] of DOT_OFFSETS) rows[centerY + offsetY][centerX + offsetX] = mark;
  }
  return rows.map((row) => row.join(''));
}

const COLORS = { o: INACTIVE_COLOR, x: ACTIVE_COLOR, r: RING_COLOR, c: CENTER_COLOR };

export const HINT_GLYPHS = {
  south: faceButtonGlyph('south'),
  east: faceButtonGlyph('east'),
  west: faceButtonGlyph('west'),
  north: faceButtonGlyph('north'),
  stick: [
    '...rrrrr...',
    '..r.....r..',
    '.r.......r.',
    'r.........r',
    'r...ccc...r',
    'r...ccc...r',
    'r...ccc...r',
    'r.........r',
    '.r.......r.',
    '..r.....r..',
    '...rrrrr...',
  ],
  start: [
    '...........',
    '...........',
    '...........',
    '.rrrrrrrrr.',
    'rrrrrrrrrrr',
    'rrrrrrrrrrr',
    'rrrrrrrrrrr',
    '.rrrrrrrrr.',
    '...........',
    '...........',
    '...........',
  ],
  tap: [
    '...........',
    '....rrr....',
    '..rr...rr..',
    '..r.....r..',
    '.r..ccc..r.',
    '.r..ccc..r.',
    '.r..ccc..r.',
    '..r.....r..',
    '..rr...rr..',
    '....rrr....',
    '...........',
  ],
};

export function drawGlyph(context, glyphName, x, y) {
  HINT_GLYPHS[glyphName].forEach((row, rowIndex) => {
    for (let column = 0; column < row.length; column++) {
      const color = COLORS[row[column]];
      if (!color) continue;
      context.fillStyle = color;
      context.fillRect(x + column, y + rowIndex, 1, 1);
    }
  });
}
