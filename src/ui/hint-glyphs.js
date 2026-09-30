// Pixel art icons for button hints, all 11x11. A face button glyph is named after its position,
// such as 'south'. The generic set shows the position on the face cluster, highlighted. The
// letters and shapes sets, named like 'letters-south', show the symbol printed on that button.
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

const BUTTON_FILL_COLOR = '#262b44';

// Five by five symbols drawn on a round button. Each character is a key into COLORS.
const SYMBOLS = {
  'letters-south': ['.ggg.', 'g...g', 'ggggg', 'g...g', 'g...g'],
  'letters-east': ['eeee.', 'e...e', 'eeee.', 'e...e', 'eeee.'],
  'letters-west': ['b...b', '.b.b.', '..b..', '.b.b.', 'b...b'],
  'letters-north': ['y...y', '.y.y.', '..y..', '..y..', '..y..'],
  'shapes-south': ['b...b', '.b.b.', '..b..', '.b.b.', 'b...b'],
  'shapes-east': ['.eee.', 'e...e', 'e...e', 'e...e', '.eee.'],
  'shapes-west': ['ppppp', 'p...p', 'p...p', 'p...p', 'ppppp'],
  'shapes-north': ['..g..', '.g.g.', '.g.g.', 'g...g', 'ggggg'],
};

const BUTTON_ROWS = [
  '...rrrrr...',
  '.rrfffffrr.',
  '.rfffffffr.',
  'rfffffffffr',
  'rfffffffffr',
  'rfffffffffr',
  'rfffffffffr',
  'rfffffffffr',
  '.rfffffffr.',
  '.rrfffffrr.',
  '...rrrrr...',
];
const SYMBOL_OFFSET = 3;

function symbolButtonGlyph(symbol) {
  return BUTTON_ROWS.map((row, rowIndex) => {
    const symbolRow = symbol[rowIndex - SYMBOL_OFFSET];
    if (!symbolRow) return row;
    return row.slice(0, SYMBOL_OFFSET) + symbolRow.replaceAll('.', 'f') + row.slice(SYMBOL_OFFSET + symbolRow.length);
  });
}

const COLORS = {
  o: INACTIVE_COLOR,
  x: ACTIVE_COLOR,
  r: RING_COLOR,
  c: CENTER_COLOR,
  f: BUTTON_FILL_COLOR,
  g: '#63c74d',
  e: '#e43b44',
  b: '#0099db',
  y: '#feae34',
  p: '#b55088',
};

// The glyph a pad hint shows on a pad of this type. Only face buttons differ between types.
export function padGlyphName(glyphName, padType) {
  if (padType === 'generic' || !(glyphName in DOT_CENTERS)) return glyphName;
  return `${padType}-${glyphName}`;
}

export const HINT_GLYPHS = {
  south: faceButtonGlyph('south'),
  east: faceButtonGlyph('east'),
  west: faceButtonGlyph('west'),
  north: faceButtonGlyph('north'),
  ...Object.fromEntries(Object.entries(SYMBOLS).map(([name, symbol]) => [name, symbolButtonGlyph(symbol)])),
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
