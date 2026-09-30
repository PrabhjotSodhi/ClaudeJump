// Display only: a small coil under each side of a player who still has spring shoe jumps left.
const OUTLINE_COLOR = '#3e2731';
const COIL_COLOR = '#feae34';
const COIL_WIDTH = 5;
const COIL_HEIGHT = 4;
const COIL_INSET = 3;

function drawCoil(context, x, y) {
  context.fillStyle = OUTLINE_COLOR;
  context.fillRect(x, y, COIL_WIDTH, COIL_HEIGHT);
  context.fillStyle = COIL_COLOR;
  context.fillRect(x + 1, y + 1, COIL_WIDTH - 2, 1);
  context.fillRect(x + 1, y + 2, 1, 1);
  context.fillRect(x + COIL_WIDTH - 2, y + 2, 1, 1);
}

// The coils sit on the bottom rows of the hitbox, so they overlap the body's feet and never the platform.
export function drawSpringShoes(context, player, drawX, drawY) {
  if (player.springJumpsRemaining <= 0 || player.inWater) return;
  const y = drawY + player.height - COIL_HEIGHT;
  drawCoil(context, drawX + COIL_INSET, y);
  drawCoil(context, drawX + player.width - COIL_INSET - COIL_WIDTH, y);
}
