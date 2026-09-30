import { SCREEN_WIDTH } from '../engine/config.js';
import { drawCharacterBody } from '../vfx/character-body.js';
import { GooglyEye, EYE_STIFFNESSES } from '../vfx/googly-eyes.js';
import { drawPanel } from './panel.js';
import { drawPlayerShape, PLAYER_SHAPE_SIZE } from './player-shapes.js';
import { PIP_SIZE } from './win-pips.js';

const PANEL_MARGIN = 8;
const PANEL_GAP = 4;
const PANEL_WIDTH = 44;
const PANEL_HEIGHT = 34;
const PANEL_PADDING = 3;
const PORTRAIT_SIZE = 24;
const PORTRAIT_BORDER = 2;
const PORTRAIT_FILL_COLOR = '#3a4466';
// The sprite frame hangs this many rows below the portrait's bottom edge, so the portrait shows head and shoulders.
const PORTRAIT_CROP_ROWS = 8;
const PIP_GAP = 3;
// The slot's shape sits in the portrait's bottom corner nearest the pips, one pixel in from the border.
const SHAPE_INSET = 1;
const PIP_OUTLINE_COLOR = '#3e2731';
const EMPTY_PIP_OUTLINE_COLOR = '#5a6988';
const EMPTY_PIP_FILL_COLOR = '#262b44';

export const PLAYER_PANEL_BOTTOM = PANEL_MARGIN + PANEL_HEIGHT;
const PORTRAIT_OUTER_SIZE = PORTRAIT_SIZE + 2 * PORTRAIT_BORDER;
const PIP_COLUMN_CENTER_OFFSET = PORTRAIT_OUTER_SIZE + 2 * PANEL_PADDING + PIP_SIZE / 2;

// Eyes that never update rest with their pupils centered.
const portraitEyesByCharacterName = new Map();

function portraitEyes(character) {
  if (!portraitEyesByCharacterName.has(character.name))
    portraitEyesByCharacterName.set(
      character.name,
      EYE_STIFFNESSES.map((stiffness) => new GooglyEye(stiffness)),
    );
  return portraitEyesByCharacterName.get(character.name);
}

// The border is the player's color.
function drawPortrait(context, character, sprite, x, y, color) {
  context.fillStyle = color;
  context.fillRect(x, y, PORTRAIT_OUTER_SIZE, PORTRAIT_OUTER_SIZE);
  context.fillStyle = PORTRAIT_FILL_COLOR;
  context.fillRect(x + PORTRAIT_BORDER, y + PORTRAIT_BORDER, PORTRAIT_SIZE, PORTRAIT_SIZE);

  context.save();
  context.beginPath();
  context.rect(x + PORTRAIT_BORDER, y + PORTRAIT_BORDER, PORTRAIT_SIZE, PORTRAIT_SIZE);
  context.clip();
  drawCharacterBody(context, {
    sprite,
    eyeFramePositions: character.eyeFramePositions,
    eyes: portraitEyes(character),
    centerX: x + PORTRAIT_BORDER + PORTRAIT_SIZE / 2,
    bottomY: y + PORTRAIT_BORDER + PORTRAIT_SIZE + PORTRAIT_CROP_ROWS,
    width: sprite.width,
    height: sprite.height,
  });
  context.restore();
}

function drawPip(context, centerX, centerY, size, outlineColor, fillColor) {
  const left = centerX - size / 2;
  const top = centerY - size / 2;
  context.fillStyle = outlineColor;
  context.fillRect(left, top, size, size);
  context.fillStyle = fillColor;
  context.fillRect(left + 1, top + 1, size - 2, size - 2);
}

// One compact panel per player along the top edge, first player leftmost. Two players take the two corners. More fill
// in beside them, and the timer's gap in the middle stays clear. Panels on the right are mirrored.
export function playerPanelBoxes(playerCount) {
  const leftEdge = { x: PANEL_MARGIN, side: 'left' };
  const leftInner = { x: PANEL_MARGIN + PANEL_WIDTH + PANEL_GAP, side: 'left' };
  const rightInner = { x: SCREEN_WIDTH - PANEL_MARGIN - 2 * PANEL_WIDTH - PANEL_GAP, side: 'right' };
  const rightEdge = { x: SCREEN_WIDTH - PANEL_MARGIN - PANEL_WIDTH, side: 'right' };
  const slots = {
    2: [leftEdge, rightEdge],
    3: [leftEdge, leftInner, rightEdge],
    4: [leftEdge, leftInner, rightInner, rightEdge],
  }[playerCount];
  return slots.map((slot) => ({ ...slot, y: PANEL_MARGIN, width: PANEL_WIDTH, height: PANEL_HEIGHT }));
}

// The portrait sits on the outer side and the win pips stand in a column beside it.
export function drawPlayerPanel(context, scene, player, { x: panelX, side }) {
  const isLeft = side === 'left';
  const portraitX = isLeft ? panelX + PANEL_PADDING : panelX + PANEL_WIDTH - PANEL_PADDING - PORTRAIT_OUTER_SIZE;
  const pipCenterX = isLeft ? panelX + PIP_COLUMN_CENTER_OFFSET : panelX + PANEL_WIDTH - PIP_COLUMN_CENTER_OFFSET;

  drawPanel(context, panelX, PANEL_MARGIN, PANEL_WIDTH, PANEL_HEIGHT);
  drawPortrait(
    context,
    player.character,
    scene.sprites[player.character.spriteName].body,
    portraitX,
    PANEL_MARGIN + PANEL_PADDING,
    player.color,
  );
  const portraitInnerTop = PANEL_MARGIN + PANEL_PADDING + PORTRAIT_BORDER;
  const shapeX = isLeft
    ? portraitX + PORTRAIT_OUTER_SIZE - PORTRAIT_BORDER - SHAPE_INSET - PLAYER_SHAPE_SIZE
    : portraitX + PORTRAIT_BORDER + SHAPE_INSET;
  const shapeY = portraitInnerTop + PORTRAIT_SIZE - SHAPE_INSET - PLAYER_SHAPE_SIZE;
  drawPlayerShape(context, player.id, shapeX, shapeY, { color: player.outlineColor ?? player.color });

  const pipsHeight = scene.winsNeeded * PIP_SIZE + (scene.winsNeeded - 1) * PIP_GAP;
  const pipsTop = PANEL_MARGIN + Math.floor((PANEL_HEIGHT - pipsHeight) / 2);
  const wins = scene.wins[player.id];
  for (let index = 0; index < scene.winsNeeded; index++) {
    drawPip(
      context,
      pipCenterX,
      pipsTop + index * (PIP_SIZE + PIP_GAP) + PIP_SIZE / 2,
      scene.winPips.pipSizeFor(player.id, index, wins, scene.tickCount),
      index < wins ? PIP_OUTLINE_COLOR : EMPTY_PIP_OUTLINE_COLOR,
      index < wins ? player.color : EMPTY_PIP_FILL_COLOR,
    );
  }
}
