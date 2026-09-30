import { SCREEN_WIDTH } from '../engine/config.js';
import { PLAYERS } from '../levels/versus-arena.js';
import { drawCharacterBody } from '../vfx/character-body.js';
import { EYE_STIFFNESSES, GooglyEye } from '../vfx/googly-eyes.js';
import { drawPanel } from './panel.js';
import { drawText, measureText } from './text.js';

// One card per seat, side by side in one row, used by player select and the online lobby.
export const SELECT_CARD_WIDTH = 148;
export const SELECT_CARD_HEIGHT = 120;
const CARD_GAP = 8;
const FRAME_INSET = 3;
const LABEL_OFFSET_Y = 8;
const BADGE_INSET = 8;
const PEDESTAL_BLOCK_SIZE = 32;
const PEDESTAL_BLOCKS = 2;
// The white outline row of the body overlaps the top edge of the pedestal so the feet read as touching.
const CHARACTER_SINK_PIXELS = 1;
const MESSAGE_OFFSET_Y = 50;
const MESSAGE_LINE_HEIGHT = 12;
// Phones show the card text at twice the size, so the pedestal and lines under it move up to make room.
const LAYOUT_BY_TEXT_SCALE = {
  1: { pedestalOffsetY: 60, nameOffsetY: 98, statusOffsetY: 108 },
  2: { pedestalOffsetY: 54, nameOffsetY: 90, statusOffsetY: 102 },
};
const MESSAGE_MAX_WIDTH = SELECT_CARD_WIDTH - 2 * BADGE_INSET;

const PICK_ARROW_DEPTH = 5;
// The pick arrows sit this far out from the card's center, level with the character's middle.
const PICK_ARROW_OFFSET_X = 48;
const PICK_ARROW_HEIGHT_ABOVE_PEDESTAL = 20;
// A tap this far or less from the card's side edge counts as a tap on that side's arrow.
export const PICK_ARROW_TAP_WIDTH = 40;

const EMPTY_FRAME_COLOR = '#3a4466';
const EMPTY_COLOR = '#5a6988';

// Every card shows the same eyes at rest.
const PORTRAIT_EYES = EYE_STIFFNESSES.map((stiffness) => new GooglyEye(stiffness));

// The card's rectangle. Four cards sit side by side and stay in seat order whether or not anyone has joined.
export function selectCardBox(seatIndex, topY) {
  const totalWidth = PLAYERS.length * SELECT_CARD_WIDTH + (PLAYERS.length - 1) * CARD_GAP;
  return {
    x: (SCREEN_WIDTH - totalWidth) / 2 + seatIndex * (SELECT_CARD_WIDTH + CARD_GAP),
    y: topY,
    width: SELECT_CARD_WIDTH,
    height: SELECT_CARD_HEIGHT,
  };
}

// -1 for a tap on the left arrow, 1 for the right arrow and 0 for anywhere else on the card.
export function pickArrowDirectionAt(box, point) {
  if (point.x < box.x + PICK_ARROW_TAP_WIDTH) return -1;
  if (point.x >= box.x + box.width - PICK_ARROW_TAP_WIDTH) return 1;
  return 0;
}

function drawFrame(context, box, color) {
  const x = box.x + FRAME_INSET;
  const y = box.y + FRAME_INSET;
  const width = box.width - 2 * FRAME_INSET;
  const height = box.height - 2 * FRAME_INSET;
  context.fillStyle = color;
  context.fillRect(x, y, width, 1);
  context.fillRect(x, y + height - 1, width, 1);
  context.fillRect(x, y + 1, 1, height - 2);
  context.fillRect(x + width - 1, y + 1, 1, height - 2);
}

function drawCenteredLine(context, text, centerX, y, color, scale = 1) {
  drawText(context, text, centerX, y, { scale, align: 'center', color, outlineColor: null });
}

// Splits a message into lines that fit across the card at the given text scale, breaking between words.
export function selectCardMessageLines(text, textScale) {
  const lines = [];
  for (const word of text.split(' ')) {
    const candidate = lines.length ? `${lines[lines.length - 1]} ${word}` : word;
    if (lines.length && measureText(candidate) * textScale <= MESSAGE_MAX_WIDTH) lines[lines.length - 1] = candidate;
    else lines.push(word);
  }
  return lines;
}

function drawPickArrows(context, centerX, topY, color) {
  context.fillStyle = color;
  for (let row = 0; row < PICK_ARROW_DEPTH * 2 - 1; row++) {
    const width = PICK_ARROW_DEPTH - Math.abs(row - (PICK_ARROW_DEPTH - 1));
    context.fillRect(centerX - PICK_ARROW_OFFSET_X - width, topY + row, width, 1);
    context.fillRect(centerX + PICK_ARROW_OFFSET_X, topY + row, width, 1);
  }
}

function drawSeatLabel(context, box, spawn, textScale) {
  const text = `${spawn.id[0].toUpperCase()}${spawn.id.slice(1)}`;
  drawCenteredLine(context, text, box.x + box.width / 2, box.y + LABEL_OFFSET_Y, spawn.color, textScale);
}

// A seat nobody sits in: a dim frame, the seat's color name and a line or two of text in the middle.
// textScale 2 is for phones, where the lines are wrapped again to fit the bigger text.
export function drawEmptySelectCard(context, box, spawn, lines, textScale = 1) {
  drawPanel(context, box.x, box.y, box.width, box.height);
  drawFrame(context, box, EMPTY_FRAME_COLOR);
  drawSeatLabel(context, box, spawn, textScale);
  const centerX = box.x + box.width / 2;
  const shownLines = textScale === 1 ? lines : lines.flatMap((line) => selectCardMessageLines(line, textScale));
  const lineHeight = MESSAGE_LINE_HEIGHT * textScale;
  const topY = box.y + MESSAGE_OFFSET_Y - Math.floor(((shownLines.length - 1) * lineHeight) / 2);
  shownLines.forEach((line, index) =>
    drawCenteredLine(context, line, centerX, topY + index * lineHeight, EMPTY_COLOR, textScale),
  );
}

// A seat with a player: their color and name at the top, the character on a pedestal with pick arrows
// while it can still change, then the character's name and a status line.
// card: { box, spawn, character, sprites, pose, canPick, status: { text, color }, leftBadge, rightBadge, textScale }.
// textScale 2 is for phones and leaves no room for badges.
export function drawSelectCard(context, card) {
  const { box, spawn, character, sprites, pose, canPick, status, textScale = 1 } = card;
  const layout = LAYOUT_BY_TEXT_SCALE[textScale];
  const centerX = box.x + box.width / 2;
  drawPanel(context, box.x, box.y, box.width, box.height);
  drawFrame(context, box, spawn.color);
  drawSeatLabel(context, box, spawn, textScale);
  const labelY = box.y + LABEL_OFFSET_Y;
  if (card.leftBadge) {
    drawText(context, card.leftBadge.text, box.x + BADGE_INSET, labelY, {
      scale: 1,
      color: card.leftBadge.color,
      outlineColor: null,
    });
  }
  if (card.rightBadge) {
    drawText(context, card.rightBadge.text, box.x + box.width - BADGE_INSET, labelY, {
      scale: 1,
      align: 'right',
      color: card.rightBadge.color,
      outlineColor: null,
    });
  }

  const pedestalY = box.y + layout.pedestalOffsetY;
  for (let block = 0; block < PEDESTAL_BLOCKS; block++) {
    const blockX = centerX - (PEDESTAL_BLOCKS * PEDESTAL_BLOCK_SIZE) / 2 + block * PEDESTAL_BLOCK_SIZE;
    context.drawImage(sprites.stoneBlocks[`block-big-${block % 2}`], blockX, pedestalY);
  }
  drawCharacterBody(context, {
    sprite: sprites[character.spriteName].body,
    eyeFramePositions: character.eyeFramePositions,
    eyes: PORTRAIT_EYES,
    centerX,
    bottomY: pedestalY + CHARACTER_SINK_PIXELS - pose.offsetY,
    width: pose.width,
    height: pose.height,
  });
  if (canPick) drawPickArrows(context, centerX, pedestalY - PICK_ARROW_HEIGHT_ABOVE_PEDESTAL, character.tagColor);

  const nameY = box.y + layout.nameOffsetY;
  drawCenteredLine(context, character.displayName, centerX, nameY, character.tagColor, textScale);
  drawCenteredLine(context, status.text, centerX, box.y + layout.statusOffsetY, status.color, textScale);
}
