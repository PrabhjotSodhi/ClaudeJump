import { TICK_RATE } from '../engine/config.js';

// Display only: the Hold the hill zone and the marker where it goes next. The zone glows yellow when empty, in the
// holder's color when one player has it, and white when it is contested.
const EMPTY_COLOR = '#fee761';
const CONTESTED_COLOR = '#ffffff';
const MARKER_COLOR = '#8b9bb4';
const MARKER_SOON_COLOR = '#fee761';
const EDGE_WIDTH = 2;
const GLOW_PULSE_TICKS = 20;
const CORNER_LENGTH = 6;
const MARKER_FLASH_TICKS = 10;
// In its last seconds the marker flashes in the zone color, so the move never comes as a surprise.
const MARKER_SOON_TICKS = 3 * TICK_RATE;

function zoneColor(scene) {
  const rules = scene.modeRules;
  if (rules.contested) return CONTESTED_COLOR;
  if (rules.holderId) return scene.players.find((player) => player.id === rules.holderId).color;
  return EMPTY_COLOR;
}

// Every fourth pixel of a checker, shifting each pulse, so the glow reads as light and not a solid block.
function drawDither(context, zone, phase) {
  for (let y = zone.y + 2; y < zone.y + zone.height; y += 2) {
    const rowOffset = (y / 2 + phase) % 2 === 0 ? 0 : 2;
    for (let x = zone.x + EDGE_WIDTH + rowOffset; x < zone.x + zone.width - EDGE_WIDTH; x += 4) {
      context.fillRect(x, y, 1, 1);
    }
  }
}

function drawCorners(context, zone) {
  const right = zone.x + zone.width;
  const bottom = zone.y + zone.height;
  context.fillRect(zone.x, zone.y, CORNER_LENGTH, EDGE_WIDTH);
  context.fillRect(zone.x, zone.y, EDGE_WIDTH, CORNER_LENGTH);
  context.fillRect(right - CORNER_LENGTH, zone.y, CORNER_LENGTH, EDGE_WIDTH);
  context.fillRect(right - EDGE_WIDTH, zone.y, EDGE_WIDTH, CORNER_LENGTH);
  context.fillRect(zone.x, bottom - CORNER_LENGTH, EDGE_WIDTH, CORNER_LENGTH);
  context.fillRect(right - EDGE_WIDTH, bottom - CORNER_LENGTH, EDGE_WIDTH, CORNER_LENGTH);
}

export function drawHillZone(context, scene) {
  const { zone, nextZone, ticksUntilMove } = scene.modeRules;
  if (!zone) return;

  const soon = ticksUntilMove <= MARKER_SOON_TICKS;
  const markerOn = !soon || Math.floor(ticksUntilMove / MARKER_FLASH_TICKS) % 2 === 0;
  if (nextZone && markerOn) {
    context.fillStyle = soon ? MARKER_SOON_COLOR : MARKER_COLOR;
    drawCorners(context, nextZone);
  }

  context.fillStyle = zoneColor(scene);
  drawDither(context, zone, Math.floor(scene.tickCount / GLOW_PULSE_TICKS) % 2);
  context.fillRect(zone.x, zone.y + zone.height - EDGE_WIDTH, zone.width, EDGE_WIDTH);
  context.fillRect(zone.x, zone.y, EDGE_WIDTH, zone.height);
  context.fillRect(zone.x + zone.width - EDGE_WIDTH, zone.y, EDGE_WIDTH, zone.height);
}
