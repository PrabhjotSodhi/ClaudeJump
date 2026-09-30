// Each player slot has a shape as well as a color, so nobody has to tell colors apart to find themselves.
// Shapes are 5x5 grids like the font's glyphs.
const SHAPE_ROWS_BY_PLAYER_ID = {
  red: ['.###.', '#####', '#####', '#####', '.###.'],
  blue: ['#####', '#####', '#####', '#####', '#####'],
  green: ['..#..', '..#..', '.###.', '.###.', '#####'],
  yellow: ['..#..', '.###.', '#####', '.###.', '..#..'],
};
export const PLAYER_SHAPE_SIZE = 5;
const OUTLINE_OFFSETS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

export function playerShapeRows(playerId) {
  return SHAPE_ROWS_BY_PLAYER_ID[playerId];
}

function fillShape(context, rows, x, y, scale, color) {
  context.fillStyle = color;
  rows.forEach((row, rowIndex) =>
    [...row].forEach((cell, columnIndex) => {
      if (cell === '#') context.fillRect(x + columnIndex * scale, y + rowIndex * scale, scale, scale);
    }),
  );
}

// x and y are the top left of the shape. The outline adds one scaled pixel on every side.
export function drawPlayerShape(context, playerId, x, y, { scale = 1, color, outlineColor = '#181425' }) {
  const rows = playerShapeRows(playerId);
  if (!rows) return;
  for (const [offsetX, offsetY] of OUTLINE_OFFSETS)
    fillShape(context, rows, x + offsetX * scale, y + offsetY * scale, scale, outlineColor);
  fillShape(context, rows, x, y, scale, color);
}
