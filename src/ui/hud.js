import { SCREEN_HEIGHT, SCREEN_WIDTH, TICK_RATE, TIMER_URGENT_SECONDS } from '../engine/config.js';
import { ROCKET_HEIGHT } from '../entities/rocket.js';
import { drawModifierIcon, MODIFIER_ICON_SIZE } from './modifier-icons.js';
import { drawPanel } from './panel.js';
import { drawPlayerPanel, PLAYER_PANEL_BOTTOM, playerPanelBoxes } from './player-panel.js';
import { drawKeyHints, drawMenuTitle, menuPanelSize } from './menu-kit.js';
import { drawMenuBackdrop } from './menu-options.js';
import { drawText, measureText } from './text.js';

const WARNING_MARKER_FLASH_TICKS = 20;
const WARNING_MARKER_SIZE = 12;
const WARNING_MARKER_GAP = 32;
const WARNING_MARKER_COLOR = '#fee761';
const TIMER_PANEL_Y = 8;
const TIMER_PANEL_PADDING_X = 6;
const TIMER_TEXT_WIDEST = '00:00';
const TIMER_COLOR = '#ffffff';
const TIMER_URGENT_COLOR = '#e43b44';
const TIMER_CALM = { scale: 1, height: 16, textTop: 5 };
const TIMER_URGENT = { scale: 2, height: 24, textTop: 6 };
const SUDDEN_DEATH_BANNER_Y = 60;
const MODIFIER_ICON_Y = 36;

function timerPanelBox({ scale, height }) {
  const width = Math.ceil((measureText(TIMER_TEXT_WIDEST) * scale + 2 * TIMER_PANEL_PADDING_X) / 2) * 2;
  return { x: (SCREEN_WIDTH - width) / 2, y: TIMER_PANEL_Y, width, height };
}

export const TIMER_PANEL = timerPanelBox(TIMER_CALM);
export const TIMER_PANEL_URGENT = timerPanelBox(TIMER_URGENT);
const SCORE_PANEL_MARGIN = 8;
const SCORE_PANEL_HEIGHT = 26;
const SCORE_PANEL_MIN_WIDTH = 56;
const SCORE_PANEL_PADDING_X = 6;
const SCORE_LABEL_TOP = 4;
const SCORE_NUMBER_TOP = 11;
const SCORE_LABEL_COLOR = '#8b9bb4';
const SCORE_NUMBER_COLOR = '#ffffff';
const NEW_BEST_COLOR = '#feae34';
const NEW_BEST_FLASH_TICKS = 120;
const NEW_BEST_BLINK_TICKS = 10;
const METER_PANEL_WIDTH = 56;
const METER_PANEL_HEIGHT = 12;
const METER_PANEL_Y = SCORE_PANEL_MARGIN + SCORE_PANEL_HEIGHT + 4;
const METER_PADDING_X = 5;
const METER_BAR_HEIGHT = 4;
const METER_TICK_WIDTH = 2;
const METER_TICK_HEIGHT = 8;
const METER_TRACK_COLOR = '#3a4466';
const METER_MARKER_COLOR = '#feae34';
const OVER_TITLE_Y = 96;
const OVER_PANEL_Y = 120;
const OVER_FIRST_ROW_OFFSET_Y = 12;
const OVER_ROW_HEIGHT = 14;
const OVER_ROW_COLOR = '#c0cbdc';
const OVER_HINT_GAP = 12;

function displayName(scene, playerId) {
  return scene.players.find((player) => player.id === playerId).character.displayName;
}

function formatCountdown(ticksRemaining) {
  const totalSeconds = Math.max(0, Math.ceil(ticksRemaining / TICK_RATE));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function phaseMessages(scene) {
  const winnerName = scene.winnerId && displayName(scene, scene.winnerId);
  switch (scene.phase) {
    case 'point':
      return [winnerName ? `${winnerName} scores!` : 'Draw!', ''];
    case 'match':
      return [scene.ticksRemaining > 0 ? `${winnerName} wins!` : '', ''];
    default:
      return ['', ''];
  }
}

function drawSuddenDeathWarning(context, scene) {
  if (scene.suddenDeathPhase !== 'warning') return;
  if (Math.floor(scene.fightTicks / WARNING_MARKER_FLASH_TICKS) % 2 !== 0) return;

  context.fillStyle = WARNING_MARKER_COLOR;
  for (let y = 0; y < SCREEN_HEIGHT; y += WARNING_MARKER_GAP) {
    if (y < PLAYER_PANEL_BOTTOM) continue;
    context.fillRect(0, y, WARNING_MARKER_SIZE, WARNING_MARKER_SIZE);
    context.fillRect(SCREEN_WIDTH - WARNING_MARKER_SIZE, y, WARNING_MARKER_SIZE, WARNING_MARKER_SIZE);
  }
}

export function drawPhaseMessage(context, scene) {
  const [title, subtitle] = phaseMessages(scene);
  if (title) drawText(context, title, SCREEN_WIDTH / 2, 60, { scale: 4, align: 'center' });
  if (subtitle) drawText(context, subtitle, SCREEN_WIDTH / 2, 96, { align: 'center' });
}

function isTimerUrgent(scene) {
  return scene.suddenDeathPhase === 'none' && scene.suddenDeathCountdownTicks <= TIMER_URGENT_SECONDS * TICK_RATE;
}

function drawTimerPanel(context, scene) {
  const urgent = isTimerUrgent(scene);
  const { scale, textTop } = urgent ? TIMER_URGENT : TIMER_CALM;
  const box = urgent ? TIMER_PANEL_URGENT : TIMER_PANEL;
  drawPanel(context, box.x, box.y, box.width, box.height);
  drawText(context, formatCountdown(scene.suddenDeathCountdownTicks), SCREEN_WIDTH / 2, box.y + textTop, {
    scale,
    align: 'center',
    color: urgent || scene.suddenDeathPhase !== 'none' ? TIMER_URGENT_COLOR : TIMER_COLOR,
    outlineColor: null,
  });
}

function drawSuddenDeathBanner(context, scene) {
  if (scene.suddenDeathPhase !== 'warning') return;
  drawText(context, 'Sudden death!', SCREEN_WIDTH / 2, SUDDEN_DEATH_BANNER_Y, {
    scale: 3,
    align: 'center',
    color: TIMER_URGENT_COLOR,
  });
}

export function drawHud(context, scene) {
  const panelBoxes = playerPanelBoxes(scene.players.length);
  scene.players.forEach((player, index) => drawPlayerPanel(context, scene, player, panelBoxes[index]));

  if (scene.phase === 'fight') drawTimerPanel(context, scene);
  if (scene.activeModifierId && (scene.phase === 'fight' || scene.phase === 'knockout')) {
    drawModifierIcon(context, scene.activeModifierId, (SCREEN_WIDTH - MODIFIER_ICON_SIZE) / 2, MODIFIER_ICON_Y);
  }

  drawPhaseMessage(context, scene);
  drawSuddenDeathBanner(context, scene);

  drawSuddenDeathWarning(context, scene);
}

// Flashes at the edge and height a rocket is about to enter from. The height is a world y, so it follows the camera.
function drawRocketWarnings(context, scene) {
  context.fillStyle = WARNING_MARKER_COLOR;
  for (const warning of scene.rocketWarnings) {
    if (Math.floor((scene.runTicks - warning.startTick) / WARNING_MARKER_FLASH_TICKS) % 2 !== 0) continue;
    const x = warning.side === 'left' ? 0 : SCREEN_WIDTH - WARNING_MARKER_SIZE;
    const y = warning.y + ROCKET_HEIGHT / 2 - WARNING_MARKER_SIZE / 2 - scene.cameraTopY;
    context.fillRect(x, Math.round(y), WARNING_MARKER_SIZE, WARNING_MARKER_SIZE);
  }
}

// How full the meter is, and where the best marker sits, both as 0 to 1 of the meter's height. The meter always
// tops out at whichever is higher, so passing the best pushes the marker down.
export function heightMeterFractions(score, best) {
  const top = Math.max(score, best);
  if (top === 0) return { fill: 0, marker: null };
  return { fill: score / top, marker: best > 0 ? best / top : null };
}

export function isNewBestFlashing(scene) {
  return scene.newBestTick !== null && scene.runTicks - scene.newBestTick < NEW_BEST_FLASH_TICKS;
}

function drawScorePanel(context, { label, value, side, labelColor }) {
  const numberText = String(value);
  const numberWidth = measureText(numberText) * 2;
  const width = Math.max(SCORE_PANEL_MIN_WIDTH, Math.ceil((numberWidth + 2 * SCORE_PANEL_PADDING_X) / 2) * 2);
  const panelX = side === 'left' ? SCORE_PANEL_MARGIN : SCREEN_WIDTH - SCORE_PANEL_MARGIN - width;
  drawPanel(context, panelX, SCORE_PANEL_MARGIN, width, SCORE_PANEL_HEIGHT);
  const textX = panelX + SCORE_PANEL_PADDING_X;
  drawText(context, label, textX, SCORE_PANEL_MARGIN + SCORE_LABEL_TOP, {
    scale: 1,
    color: labelColor,
    outlineColor: null,
  });
  drawText(context, numberText, textX, SCORE_PANEL_MARGIN + SCORE_NUMBER_TOP, {
    scale: 2,
    color: SCORE_NUMBER_COLOR,
    outlineColor: null,
  });
}

function drawHeightMeter(context, scene) {
  const panelX = SCREEN_WIDTH - SCORE_PANEL_MARGIN - METER_PANEL_WIDTH;
  drawPanel(context, panelX, METER_PANEL_Y, METER_PANEL_WIDTH, METER_PANEL_HEIGHT);
  const barX = panelX + METER_PADDING_X;
  const barY = METER_PANEL_Y + Math.floor((METER_PANEL_HEIGHT - METER_BAR_HEIGHT) / 2);
  const barWidth = METER_PANEL_WIDTH - 2 * METER_PADDING_X;
  context.fillStyle = METER_TRACK_COLOR;
  context.fillRect(barX, barY, barWidth, METER_BAR_HEIGHT);

  const { fill, marker } = heightMeterFractions(scene.score, scene.bestScore);
  context.fillStyle = scene.players[0].color;
  context.fillRect(barX, barY, Math.round(fill * barWidth), METER_BAR_HEIGHT);
  if (marker === null) return;
  const tickX = barX + Math.min(barWidth - METER_TICK_WIDTH, Math.round(marker * barWidth));
  const tickY = barY - Math.floor((METER_TICK_HEIGHT - METER_BAR_HEIGHT) / 2);
  context.fillStyle = METER_MARKER_COLOR;
  context.fillRect(tickX, tickY, METER_TICK_WIDTH, METER_TICK_HEIGHT);
}

function drawRunOver(context, scene) {
  drawMenuTitle(context, 'Splash!', OVER_TITLE_Y);
  const rows = [`Score ${scene.score}`, `Best ${scene.bestScore}`];
  if (scene.newBestTick !== null) rows.push('New best!');
  const { width, height } = menuPanelSize(rows);
  drawPanel(context, (SCREEN_WIDTH - width) / 2, OVER_PANEL_Y, width, height);
  rows.forEach((row, index) => {
    drawText(context, row, SCREEN_WIDTH / 2, OVER_PANEL_Y + OVER_FIRST_ROW_OFFSET_Y + index * OVER_ROW_HEIGHT, {
      scale: 1,
      align: 'center',
      color: index === 2 ? NEW_BEST_COLOR : OVER_ROW_COLOR,
      outlineColor: null,
    });
  });
  drawKeyHints(
    context,
    [{ keys: [{ player: 'red', control: 'jump' }], pad: ['south'], label: 'Retry' }],
    OVER_PANEL_Y + height + OVER_HINT_GAP,
  );
}

export function drawSurvivalHud(context, scene) {
  drawRocketWarnings(context, scene);
  if (scene.phase === 'over') drawMenuBackdrop(context);
  const flashing = isNewBestFlashing(scene);
  const blinkOn = flashing && Math.floor(scene.runTicks / NEW_BEST_BLINK_TICKS) % 2 === 0;
  drawScorePanel(context, { label: 'Score', value: scene.score, side: 'left', labelColor: SCORE_LABEL_COLOR });
  drawScorePanel(context, {
    label: flashing ? 'New best!' : 'Best',
    value: Math.max(scene.bestScore, scene.score),
    side: 'right',
    labelColor: blinkOn ? NEW_BEST_COLOR : SCORE_LABEL_COLOR,
  });
  drawHeightMeter(context, scene);
  if (scene.phase === 'over') drawRunOver(context, scene);
}
