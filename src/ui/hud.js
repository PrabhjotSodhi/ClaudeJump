import { SCREEN_WIDTH } from '../engine/config.js';
import { drawText } from './text.js';

function capitalize(id) {
  return id[0].toUpperCase() + id.slice(1);
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
      return [`${winnerName} wins!`, scene.ticksRemaining <= 0 ? 'Jump to play again' : ''];
    default:
      return ['', ''];
  }
}

export function drawHud(context, scene) {
  drawText(context, `Red Wins: ${scene.wins.red}`, 4, 4);
  drawText(context, `Blue Wins: ${scene.wins.blue}`, SCREEN_WIDTH - 4, 4, { align: 'right' });

  const [title, subtitle] = phaseMessages(scene);
  if (title) drawText(context, title, SCREEN_WIDTH / 2, 30, { scale: 2, align: 'center' });
  if (subtitle) drawText(context, subtitle, SCREEN_WIDTH / 2, 48, { align: 'center' });
}
