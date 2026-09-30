import { SCREEN_HEIGHT, SCREEN_WIDTH, TICK_RATE } from '../engine/config.js';
import { ROCKET_HEIGHT } from '../entities/rocket.js';
import { drawPanel } from './panel.js';
import { drawPlayerPanel, PLAYER_PANEL_BOTTOM } from './player-panel.js';
import { drawKeyHints, drawMenuTitle, menuPanelSize } from './menu-kit.js';
import { drawText, measureText } from './text.js';

const WARNING_MARKER_FLASH_TICKS = 20;
const WARNING_MARKER_SIZE = 12;
const WARNING_MARKER_GAP = 32;
const WARNING_MARKER_COLOR = '#fee761';
const TIMER_PANEL_WIDTH = 44;
const TIMER_PANEL_HEIGHT = 16;
const TIMER_PANEL_Y = 8;
const TIMER_TEXT_TOP = 5;
const TIMER_COLOR = '#ffffff';
const TIMER_SUDDEN_DEATH_COLOR = '#e43b44';
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
const METER_WIDTH = 6;
const METER_TOP = SCORE_PANEL_MARGIN + SCORE_PANEL_HEIGHT + SCORE_PANEL_MARGIN;
const METER_BORDER_COLOR = '#3e2731';
const METER_TRACK_COLOR = '#262b44';
const METER_FILL_COLOR = '#63c74d';
const METER_MARKER_COLOR = '#feae34';
const METER_MARKER_OVERHANG = 2;
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
    case 'ready': {
      const totalWins = Object.values(scene.wins).reduce((sum, wins) => sum + wins, 0);
      return ['Ready...', totalWins === 0 ? 'Red: WASD    Blue: Arrows' : ''];
    }
    case 'fight':
      return [scene.ticksRemaining > 0 ? 'Go!' : '', ''];
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

function drawTimerPanel(context, scene) {
  const x = (SCREEN_WIDTH - TIMER_PANEL_WIDTH) / 2;
  drawPanel(context, x, TIMER_PANEL_Y, TIMER_PANEL_WIDTH, TIMER_PANEL_HEIGHT);
  drawText(
    context,
    formatCountdown(scene.suddenDeathCountdownTicks),
    SCREEN_WIDTH / 2,
    TIMER_PANEL_Y + TIMER_TEXT_TOP,
    {
      scale: 1,
      align: 'center',
      color: scene.suddenDeathPhase === 'none' ? TIMER_COLOR : TIMER_SUDDEN_DEATH_COLOR,
      outlineColor: null,
    },
  );
}

export function drawHud(context, scene) {
  for (const player of scene.players) {
    if (player.id === 'red') drawPlayerPanel(context, scene, player, 'left');
    if (player.id === 'blue') drawPlayerPanel(context, scene, player, 'right');
  }

  if (scene.phase === 'fight') drawTimerPanel(context, scene);

  drawPhaseMessage(context, scene);

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

function drawHeightMeter(context, score, best) {
  const x = SCREEN_WIDTH - SCORE_PANEL_MARGIN - METER_WIDTH;
  const height = SCREEN_HEIGHT - SCORE_PANEL_MARGIN - METER_TOP;
  const innerHeight = height - 2;
  context.fillStyle = METER_BORDER_COLOR;
  context.fillRect(x, METER_TOP, METER_WIDTH, height);
  context.fillStyle = METER_TRACK_COLOR;
  context.fillRect(x + 1, METER_TOP + 1, METER_WIDTH - 2, innerHeight);

  const { fill, marker } = heightMeterFractions(score, best);
  const fillHeight = Math.round(fill * innerHeight);
  context.fillStyle = METER_FILL_COLOR;
  context.fillRect(x + 1, METER_TOP + 1 + innerHeight - fillHeight, METER_WIDTH - 2, fillHeight);
  if (marker === null) return;
  const markerY = METER_TOP + 1 + innerHeight - Math.round(marker * innerHeight);
  context.fillStyle = METER_MARKER_COLOR;
  context.fillRect(x - METER_MARKER_OVERHANG, markerY - 1, METER_WIDTH + 2 * METER_MARKER_OVERHANG, 2);
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
  drawKeyHints(context, [{ keys: ['W', 'Pad A'], label: 'Retry' }], OVER_PANEL_Y + height + OVER_HINT_GAP);
}

export function drawSurvivalHud(context, scene) {
  drawRocketWarnings(context, scene);
  const flashing = isNewBestFlashing(scene);
  const blinkOn = flashing && Math.floor(scene.runTicks / NEW_BEST_BLINK_TICKS) % 2 === 0;
  drawScorePanel(context, { label: 'Score', value: scene.score, side: 'left', labelColor: SCORE_LABEL_COLOR });
  drawScorePanel(context, {
    label: flashing ? 'New best!' : 'Best',
    value: Math.max(scene.bestScore, scene.score),
    side: 'right',
    labelColor: blinkOn ? NEW_BEST_COLOR : SCORE_LABEL_COLOR,
  });
  drawHeightMeter(context, scene.score, scene.bestScore);
  if (scene.phase === 'over') drawRunOver(context, scene);
}
