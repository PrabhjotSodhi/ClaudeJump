import { SCREEN_HEIGHT, SCREEN_WIDTH, TICK_RATE } from '../engine/config.js';
import { drawText } from './text.js';

const WARNING_MARKER_FLASH_TICKS = 20;
const WARNING_MARKER_SIZE = 6;
const WARNING_MARKER_GAP = 16;
const WARNING_MARKER_COLOR = '#ffdc28';
const BADGE_COLOR = '#ffdc28';
const RESULTS_TOP_Y = 62;
const RESULTS_ROW_HEIGHT = 9;
const RESULTS_COLUMN_OFFSET_X = 74;

function capitalize(id) {
  return id[0].toUpperCase() + id.slice(1);
}

function formatCountdown(ticksRemaining) {
  const totalSeconds = Math.max(0, Math.ceil(ticksRemaining / TICK_RATE));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function phaseMessages(scene) {
  const winnerName = scene.winnerId && capitalize(scene.winnerId);
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

// Placeholder layout: each player's column of stats, in their own color, with a gold badge for
// the most stomps (every tied player gets one) and their readiness for the next match.
function drawMatchResults(context, scene) {
  const stats = scene.matchStats;
  const badgeIds = new Set(stats.mostStomps());

  scene.players.forEach((player, columnIndex) => {
    const x = SCREEN_WIDTH / 2 + (columnIndex === 0 ? -RESULTS_COLUMN_OFFSET_X : RESULTS_COLUMN_OFFSET_X);
    let y = RESULTS_TOP_Y;

    drawText(context, capitalize(player.id), x, y, { align: 'center', color: player.color });
    y += RESULTS_ROW_HEIGHT;
    drawText(context, `Wins ${scene.wins[player.id]}`, x, y, { align: 'center' });
    y += RESULTS_ROW_HEIGHT;
    drawText(context, `Stomps ${stats.stomps[player.id]}`, x, y, { align: 'center' });
    y += RESULTS_ROW_HEIGHT;
    drawText(context, `Falls ${stats.fallsIn[player.id]}`, x, y, { align: 'center' });
    y += RESULTS_ROW_HEIGHT;
    if (badgeIds.has(player.id)) drawText(context, 'Most stomps', x, y, { align: 'center', color: BADGE_COLOR });
    y += RESULTS_ROW_HEIGHT;
    drawText(context, scene.matchReadyIds.has(player.id) ? 'Ready!' : 'Press jump', x, y, {
      align: 'center',
      color: player.color,
    });
  });
}

export function drawHud(context, scene) {
  drawText(context, `Red Wins: ${scene.wins.red}`, 4, 4);
  drawText(context, `Blue Wins: ${scene.wins.blue}`, SCREEN_WIDTH - 4, 4, { align: 'right' });

  if (scene.phase === 'fight')
    drawText(context, formatCountdown(scene.suddenDeathCountdownTicks), SCREEN_WIDTH / 2, 4, { align: 'center' });

  const [title, subtitle] = phaseMessages(scene);
  if (title) drawText(context, title, SCREEN_WIDTH / 2, 30, { scale: 2, align: 'center' });
  if (subtitle) drawText(context, subtitle, SCREEN_WIDTH / 2, 48, { align: 'center' });

  if (scene.phase === 'match' && scene.ticksRemaining <= 0) drawMatchResults(context, scene);

  drawSuddenDeathWarning(context, scene);
}
