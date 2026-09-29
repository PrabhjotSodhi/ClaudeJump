// Googly eyes are display only. They update once per tick from a body's velocity, and game logic never reads them.

const WHITE_DIAMETER = 7;
const PUPIL_DIAMETER = 3;
const MAX_PUPIL_OFFSET = (WHITE_DIAMETER - PUPIL_DIAMETER) / 2;
// The pupil trails this many pixels behind each pixel per tick the body moves.
const LAG_PER_VELOCITY = 1.3;
const DAMPING = 0.1;
const RIM_BOUNCE = 0.7;
const JUMP_KICK = 3;
const HIT_KICK = 4;
const RIM_COLOR = '#3e2731';
const WHITE_COLOR = '#ffffff';
const SHADE_COLOR = '#c0cbdc';
const PUPIL_COLOR = '#181425';

// The eye is the white disc plus a 1 pixel rim, so it is this wide and tall.
export const EYE_SIZE = WHITE_DIAMETER + 2;

// For each row of a pixel disc, the first and last filled column.
function discSpans(diameter) {
  const radius = diameter / 2;
  const spans = [];
  for (let y = 0; y < diameter; y++) {
    const offsetY = y + 0.5 - radius;
    const halfWidth = Math.sqrt(radius * radius - offsetY * offsetY);
    const start = Math.ceil(radius - 0.5 - halfWidth);
    spans.push([start, diameter - 1 - start]);
  }
  return spans;
}

export const EYE_WHITE_SPANS = discSpans(WHITE_DIAMETER);
const PUPIL_SPANS = discSpans(PUPIL_DIAMETER);

function isWhite(x, y) {
  const span = EYE_WHITE_SPANS[y];
  return span !== undefined && x >= span[0] && x <= span[1];
}

function pupilPixelsAt(offsetX, offsetY) {
  const left = MAX_PUPIL_OFFSET + offsetX;
  const top = MAX_PUPIL_OFFSET + offsetY;
  return PUPIL_SPANS.flatMap(([start, end], row) => {
    const pixels = [];
    for (let column = start; column <= end; column++) pixels.push([left + column, top + row]);
    return pixels;
  });
}

let eyeCanvas = null;

// Rim, white and a shade on the bottom right, lit from the top left. Built once, then stamped.
function eyeImage() {
  if (eyeCanvas) return eyeCanvas;
  eyeCanvas = document.createElement('canvas');
  eyeCanvas.width = EYE_SIZE;
  eyeCanvas.height = EYE_SIZE;
  const context = eyeCanvas.getContext('2d');
  for (let y = -1; y <= WHITE_DIAMETER; y++) {
    for (let x = -1; x <= WHITE_DIAMETER; x++) {
      let color = null;
      if (isWhite(x, y)) color = isWhite(x + 1, y + 1) ? WHITE_COLOR : SHADE_COLOR;
      else if (isWhite(x + 1, y) || isWhite(x - 1, y) || isWhite(x, y + 1) || isWhite(x, y - 1)) color = RIM_COLOR;
      if (!color) continue;
      context.fillStyle = color;
      context.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  return eyeCanvas;
}

// The pupil is a damped spring. Its rest point trails opposite to the body's velocity, so it settles in the
// center when the body is still. It bounces off the inside of the rim.
export class GooglyEye {
  constructor(stiffness) {
    this.stiffness = stiffness;
    this.offsetX = 0;
    this.offsetY = 0;
    this.velocityX = 0;
    this.velocityY = 0;
  }

  update(bodyVelocityX, bodyVelocityY) {
    const restX = -bodyVelocityX * LAG_PER_VELOCITY;
    const restY = -bodyVelocityY * LAG_PER_VELOCITY;
    this.velocityX += (restX - this.offsetX) * this.stiffness - this.velocityX * DAMPING;
    this.velocityY += (restY - this.offsetY) * this.stiffness - this.velocityY * DAMPING;
    this.offsetX += this.velocityX;
    this.offsetY += this.velocityY;

    const distance = Math.hypot(this.offsetX, this.offsetY);
    if (distance <= MAX_PUPIL_OFFSET) return;
    const normalX = this.offsetX / distance;
    const normalY = this.offsetY / distance;
    this.offsetX = normalX * MAX_PUPIL_OFFSET;
    this.offsetY = normalY * MAX_PUPIL_OFFSET;
    const outwardSpeed = this.velocityX * normalX + this.velocityY * normalY;
    if (outwardSpeed > 0) {
      this.velocityX -= (1 + RIM_BOUNCE) * outwardSpeed * normalX;
      this.velocityY -= (1 + RIM_BOUNCE) * outwardSpeed * normalY;
    }
  }

  jump() {
    this.velocityY -= JUMP_KICK;
  }

  // directionX is the way the hit pushes the body: -1 for left, 1 for right. The pupil stays behind and rattles.
  hit(directionX) {
    this.velocityX -= directionX * HIT_KICK;
    this.velocityY -= HIT_KICK / 2;
  }

  // The pupil's pixels, relative to the top left of the eye white. Rounding can push a diagonal pupil past the rim,
  // so it then falls back to truncating, which always fits.
  pupilPixels() {
    const rounded = pupilPixelsAt(Math.round(this.offsetX), Math.round(this.offsetY));
    if (rounded.every(([x, y]) => isWhite(x, y))) return rounded;
    return pupilPixelsAt(Math.trunc(this.offsetX), Math.trunc(this.offsetY));
  }
}

// x and y are the top left of the eye, rim included.
export function drawGooglyEye(context, eye, x, y) {
  context.drawImage(eyeImage(), x, y);
  context.fillStyle = PUPIL_COLOR;
  for (const [pupilX, pupilY] of eye.pupilPixels()) context.fillRect(x + 1 + pupilX, y + 1 + pupilY, 1, 1);
}
