import { SCREEN_HEIGHT, SCREEN_WIDTH, TICK_RATE } from '../engine/config.js';
import { drawText } from './text.js';

const WARNING_MARKER_FLASH_TICKS = 20;
const WARNING_MARKER_SIZE = 12;
const WARNING_MARKER_GAP = 32;
const WARNING_MARKER_COLOR = '#fee761';

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
      return [`${winnerName} wins!`, ''];
    default:
      return ['', ''];
  }
}

function drawSuddenDeathWarning(context, scene) {
  if (scene.suddenDeathPhase !== 'warning') return;
  if (Math.floor(scene.fightTicks / WARNING_MARKER_FLASH_TICKS) % 2 !== 0) return;

  context.fillStyle = WARNING_MARKER_COLOR;
  for (let y = 0; y < SCREEN_HEIGHT; y += WARNING_MARKER_GAP) {
    context.fillRect(0, y, WARNING_MARKER_SIZE, WARNING_MARKER_SIZE);
    context.fillRect(SCREEN_WIDTH - WARNING_MARKER_SIZE, y, WARNING_MARKER_SIZE, WARNING_MARKER_SIZE);
  }
}

export function drawPhaseMessage(context, scene) {
  const [title, subtitle] = phaseMessages(scene);
  if (title) drawText(context, title, SCREEN_WIDTH / 2, 60, { scale: 4, align: 'center' });
  if (subtitle) drawText(context, subtitle, SCREEN_WIDTH / 2, 96, { align: 'center' });
}

export function drawHud(context, scene) {
  drawText(context, `${displayName(scene, 'red')} Wins: ${scene.wins.red}`, 8, 8);
  drawText(context, `${displayName(scene, 'blue')} Wins: ${scene.wins.blue}`, SCREEN_WIDTH - 8, 8, { align: 'right' });

  if (scene.phase === 'fight')
    drawText(context, formatCountdown(scene.suddenDeathCountdownTicks), SCREEN_WIDTH / 2, 8, { align: 'center' });

  drawPhaseMessage(context, scene);

  drawSuddenDeathWarning(context, scene);
}

export function formatScore(label, score) {
  return `${label}: ${String(score).padStart(10, '0')}`;
}

export function drawSurvivalHud(context, scene) {
  drawText(context, formatScore('Score', scene.score), 8, 8);
  drawText(context, formatScore('Best', Math.max(scene.bestScore, scene.score)), SCREEN_WIDTH - 8, 8, {
    align: 'right',
  });
  if (scene.phase === 'over') {
    drawText(context, 'Splash!', SCREEN_WIDTH / 2, 60, { scale: 4, align: 'center' });
    drawText(context, 'Jump to try again', SCREEN_WIDTH / 2, 96, { align: 'center' });
  }
}
