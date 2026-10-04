import { CRATE_HEIGHT } from '../entities/crate.js';
import { CARD_ICON_HEIGHT, CARD_ICON_OUTLINE_MARGIN, CARD_ICON_WIDTH, drawCardIcon } from '../ui/card-icons.js';
import { RAMPS, toPixel } from './particle-rules.js';

// About 0.3 seconds: long enough for everyone to see what came out of the crate.
export const OPENING_TICKS = 18;
const ICON_RISE_PIXELS = 14;
const ICON_SPIN_PERIOD_TICKS = 12;
const ICON_MIN_WIDTH = 2;
// A broken crate throws these planks from its middle: offset, launch speed and size in pixels. Each tumbles a quarter
// turn every PLANK_TURN_TICKS, swapping its width and height, so it stays on whole pixels.
const PLANKS = [
  { x: -8, y: -10, speedX: -1.6, speedY: -3.6, width: 14, height: 4 },
  { x: 0, y: -10, speedX: 1.4, speedY: -3.9, width: 12, height: 4 },
  { x: -12, y: -6, speedX: -2.8, speedY: -2.4, width: 4, height: 14 },
  { x: 8, y: -6, speedX: 2.7, speedY: -2.6, width: 4, height: 12 },
  { x: -6, y: 4, speedX: -2, speedY: -1.5, width: 12, height: 4 },
  { x: 2, y: 4, speedX: 2.2, speedY: -1.7, width: 10, height: 4 },
];
const PLANK_GRAVITY = 0.3;
const PLANK_TURN_TICKS = 6;
export const BREAK_TICKS = 34;
const PLANK_COLORS = { outline: '#3e2731', wood: '#b86f50', light: '#e4a672' };
const GOLDEN_PLANK_COLORS = { outline: '#3e2731', wood: '#feae34', light: '#fee761' };
// Dust puffs roll out from the crate's corners and fade from light to darker grey.
const DUST_SPOTS = [
  [-12, -12, -1, -1],
  [12, -12, 1, -1],
  [-12, 10, -1, 0],
  [12, 10, 1, 0],
  [0, 12, 0, 0],
];
const DUST_TICKS = 16;
const ICON_CANVAS_SIZE = CARD_ICON_WIDTH + CARD_ICON_OUTLINE_MARGIN * 2;

// How wide, in whole pixels, the spinning card icon is drawn `age` ticks after the crate opened. It turns edge-on and
// back, like a coin.
export function spinningIconWidth(age) {
  const turn = Math.abs(Math.cos((age * Math.PI) / ICON_SPIN_PERIOD_TICKS));
  return Math.max(ICON_MIN_WIDTH, Math.round(ICON_CANVAS_SIZE * turn));
}

// Display only: when a card is picked up, the crate breaks apart into planks and dust and the card's icon spins up out
// of it. A crate that sinks breaks the same way in the water. Game logic never reads it.
export class CrateOpenings {
  constructor() {
    this.openings = [];
    this.breaks = [];
    this.iconCanvases = new Map();
  }

  attach(events, getPlayers) {
    events.on('card-picked-up', ({ playerId, cardName, golden, x, y }) => {
      if (x === undefined) return;
      const color = getPlayers().find((player) => player.id === playerId)?.color ?? '#ffffff';
      this.openings.push({ x, y, cardName, golden, color, age: 0 });
      this.breaks.push({ x, y: y + CRATE_HEIGHT / 2, golden, age: 0 });
    });
    events.on('crate-fell-in-water', ({ x, y, golden = false }) => {
      this.breaks.push({ x, y: y - CRATE_HEIGHT / 2, golden, age: 0 });
    });
  }

  update() {
    for (const opening of this.openings) opening.age++;
    this.openings = this.openings.filter((opening) => opening.age < OPENING_TICKS);
    for (const crateBreak of this.breaks) crateBreak.age++;
    this.breaks = this.breaks.filter((crateBreak) => crateBreak.age < BREAK_TICKS);
  }

  iconCanvas(cardName, color) {
    const key = `${cardName} ${color}`;
    if (!this.iconCanvases.has(key)) {
      const canvas = document.createElement('canvas');
      canvas.width = ICON_CANVAS_SIZE;
      canvas.height = CARD_ICON_HEIGHT + CARD_ICON_OUTLINE_MARGIN * 2;
      drawCardIcon(canvas.getContext('2d'), cardName, CARD_ICON_OUTLINE_MARGIN, CARD_ICON_OUTLINE_MARGIN, color);
      this.iconCanvases.set(key, canvas);
    }
    return this.iconCanvases.get(key);
  }

  render(context) {
    context.imageSmoothingEnabled = false;
    for (const crateBreak of this.breaks) {
      renderDust(context, crateBreak);
      renderPlanks(context, crateBreak);
    }
    for (const opening of this.openings) {
      const icon = this.iconCanvas(opening.cardName, opening.color);
      const width = spinningIconWidth(opening.age);
      const rise = Math.round((ICON_RISE_PIXELS * Math.min(opening.age, OPENING_TICKS / 2)) / (OPENING_TICKS / 2));
      const left = Math.round(opening.x) - Math.floor(width / 2);
      const top = Math.round(opening.y) - icon.height - rise;
      context.drawImage(icon, left, top, width, icon.height);
    }
  }
}

// Where each plank of a break is `age` ticks in, as whole pixel rectangles.
export function plankRectangles({ x, y, age }) {
  return PLANKS.map((plank) => {
    const turned = Math.floor(age / PLANK_TURN_TICKS) % 2 === 1;
    const width = turned ? plank.height : plank.width;
    const height = turned ? plank.width : plank.height;
    const centerX = x + plank.x + plank.width / 2 + plank.speedX * age;
    const centerY = y + plank.y + plank.height / 2 + plank.speedY * age + (PLANK_GRAVITY * age * age) / 2;
    return {
      x: toPixel(centerX - width / 2),
      y: toPixel(centerY - height / 2),
      width,
      height,
    };
  });
}

function renderPlanks(context, crateBreak) {
  const colors = crateBreak.golden ? GOLDEN_PLANK_COLORS : PLANK_COLORS;
  for (const { x, y, width, height } of plankRectangles(crateBreak)) {
    context.fillStyle = colors.outline;
    context.fillRect(x, y, width, height);
    context.fillStyle = colors.wood;
    context.fillRect(x + 1, y + 1, width - 2, height - 2);
    context.fillStyle = colors.light;
    context.fillRect(x + 1, y + 1, width - 2, 1);
  }
}

function renderDust(context, { x, y, age }) {
  if (age >= DUST_TICKS) return;
  const size = age < DUST_TICKS / 2 ? 4 : 2;
  const spread = Math.floor(age / 2);
  context.fillStyle = RAMPS.dust[Math.floor((age / DUST_TICKS) * RAMPS.dust.length)];
  for (const [offsetX, offsetY, directionX, directionY] of DUST_SPOTS) {
    context.fillRect(
      toPixel(x + offsetX + directionX * spread - size / 2),
      toPixel(y + offsetY + directionY * spread - size / 2 - Math.floor(age / 4)),
      size,
      size,
    );
  }
}
