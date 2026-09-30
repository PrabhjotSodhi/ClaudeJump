import { CARD_ICON_HEIGHT, CARD_ICON_OUTLINE_MARGIN, CARD_ICON_WIDTH, drawCardIcon } from '../ui/card-icons.js';

// About 0.3 seconds: long enough for everyone to see what came out of the crate.
export const OPENING_TICKS = 18;
const ICON_RISE_PIXELS = 14;
const ICON_SPIN_PERIOD_TICKS = 12;
const ICON_MIN_WIDTH = 2;
const LID_SPEED_X = 1.2;
const LID_SPEED_Y = -2.6;
const LID_GRAVITY = 0.3;
const LID_WIDTH = 7;
const LID_HEIGHT = 3;
const LID_COLORS = { outline: '#3e2731', wood: '#b86f50', light: '#e4a672' };
const GOLDEN_LID_COLORS = { outline: '#3e2731', wood: '#feae34', light: '#fee761' };
const SPLINTERS = [
  [-1.8, -1.6],
  [1.8, -1.6],
  [-0.8, -3],
  [0.8, -3],
];
const SPLINTER_TICKS = 10;
const ICON_CANVAS_SIZE = CARD_ICON_WIDTH + CARD_ICON_OUTLINE_MARGIN * 2;

// How wide, in whole pixels, the spinning card icon is drawn `age` ticks after the crate opened. It turns edge-on and
// back, like a coin.
export function spinningIconWidth(age) {
  const turn = Math.abs(Math.cos((age * Math.PI) / ICON_SPIN_PERIOD_TICKS));
  return Math.max(ICON_MIN_WIDTH, Math.round(ICON_CANVAS_SIZE * turn));
}

// Display only: when a card is picked up, the crate's lid bursts off in two halves and the card's icon spins up out
// of it. Game logic never reads it.
export class CrateOpenings {
  constructor() {
    this.openings = [];
    this.iconCanvases = new Map();
  }

  attach(events, getPlayers) {
    events.on('card-picked-up', ({ playerId, cardName, golden, x, y }) => {
      if (x === undefined) return;
      const color = getPlayers().find((player) => player.id === playerId)?.color ?? '#ffffff';
      this.openings.push({ x, y, cardName, golden, color, age: 0 });
    });
  }

  update() {
    for (const opening of this.openings) opening.age++;
    this.openings = this.openings.filter((opening) => opening.age < OPENING_TICKS);
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
    for (const opening of this.openings) {
      this.renderLid(context, opening);
      const icon = this.iconCanvas(opening.cardName, opening.color);
      const width = spinningIconWidth(opening.age);
      const rise = Math.round((ICON_RISE_PIXELS * Math.min(opening.age, OPENING_TICKS / 2)) / (OPENING_TICKS / 2));
      const left = Math.round(opening.x) - Math.floor(width / 2);
      const top = Math.round(opening.y) - icon.height - rise;
      context.drawImage(icon, left, top, width, icon.height);
    }
  }

  renderLid(context, { x, y, golden, age }) {
    const colors = golden ? GOLDEN_LID_COLORS : LID_COLORS;
    const lift = Math.round(LID_SPEED_Y * age + (LID_GRAVITY * age * age) / 2);
    for (const direction of [-1, 1]) {
      const left = Math.round(x + direction * (LID_SPEED_X * age + 1)) - (direction < 0 ? LID_WIDTH : 0);
      const top = Math.round(y) + lift;
      context.fillStyle = colors.outline;
      context.fillRect(left, top, LID_WIDTH, LID_HEIGHT);
      context.fillStyle = colors.wood;
      context.fillRect(left + 1, top + 1, LID_WIDTH - 2, LID_HEIGHT - 2);
      context.fillStyle = colors.light;
      context.fillRect(left + 1, top + 1, LID_WIDTH - 3, 1);
    }
    if (age >= SPLINTER_TICKS) return;
    context.fillStyle = colors.light;
    for (const [speedX, speedY] of SPLINTERS) {
      context.fillRect(
        Math.round(x + speedX * age),
        Math.round(y + speedY * age + (LID_GRAVITY * age * age) / 2),
        1,
        1,
      );
    }
  }
}
