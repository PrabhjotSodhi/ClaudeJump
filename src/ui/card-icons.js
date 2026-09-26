// Tiny pixel icons for each card, drawn on whole pixels so they stay crisp at any scale.
export const CARD_ICON_WIDTH = 5;
export const CARD_ICON_HEIGHT = 5;
// drawCardIcon outlines the icon by one pixel on every side, including above and below.
export const CARD_ICON_OUTLINE_MARGIN = 1;

const ICON_PIXELS = {
  dash: ['#.#..', '.#.#.', '..#.#', '.#.#.', '#.#..'],
  rocket: ['..#..', '.###.', '.###.', '#####', '#.#.#'],
  bouncePad: ['..#..', '.###.', '..#..', '.....', '#####'],
  fire: ['..#..', '.#.#.', '#...#', '#...#', '.###.'],
  ice: ['..#..', '#.#.#', '.###.', '#.#.#', '..#..'],
};

const ICON_OUTLINE_OFFSETS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

function fillPixels(context, rows, x, y, color) {
  context.fillStyle = color;
  rows.forEach((row, rowIndex) =>
    [...row].forEach((cell, columnIndex) => {
      if (cell === '#') context.fillRect(x + columnIndex, y + rowIndex, 1, 1);
    }),
  );
}

// Outlined in the player's color, like drawText: the shape is drawn once per neighboring
// pixel offset in the outline color, then once more in white on top.
function drawOutlined(context, rows, x, y, outlineColor) {
  for (const [offsetX, offsetY] of ICON_OUTLINE_OFFSETS)
    fillPixels(context, rows, x + offsetX, y + offsetY, outlineColor);
  fillPixels(context, rows, x, y, '#fff');
}

// While flashing, the icon sits on a solid badge of the player's color instead of a thin
// outline, so the moment the card is played reads as a brief flash before it disappears.
function drawFlashing(context, rows, x, y, outlineColor) {
  context.fillStyle = outlineColor;
  context.fillRect(x - 1, y - 1, CARD_ICON_WIDTH + 2, CARD_ICON_HEIGHT + 2);
  fillPixels(context, rows, x, y, '#fff');
}

export function drawCardIcon(context, cardName, x, y, outlineColor, { flashing = false } = {}) {
  const rows = ICON_PIXELS[cardName];
  if (!rows) return;

  if (flashing) drawFlashing(context, rows, x, y, outlineColor);
  else drawOutlined(context, rows, x, y, outlineColor);
}
