const BORDER_COLOR = '#3e2731';
const FILL_COLOR = '#262b44';
const HIGHLIGHT_COLOR = '#3a4466';

export function drawPanel(context, x, y, width, height) {
  context.fillStyle = BORDER_COLOR;
  context.fillRect(x + 1, y, width - 2, height);
  context.fillRect(x, y + 1, width, height - 2);
  context.fillStyle = FILL_COLOR;
  context.fillRect(x + 2, y + 2, width - 4, height - 4);
  context.fillStyle = HIGHLIGHT_COLOR;
  context.fillRect(x + 2, y + 2, width - 4, 1);
}
