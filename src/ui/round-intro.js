import { ROUND_COUNTDOWN_BEAT_TICKS, ROUND_GO_TICKS, SCREEN_WIDTH } from '../engine/config.js';
import { drawPlayHints, playHintRows } from './play-hints.js';
import { drawModifierIcon, MODIFIER_ICON_SIZE } from './modifier-icons.js';
import { drawText, measureText, TEXT_GLYPH_HEIGHT } from './text.js';

const COUNT_Y = 56;
const COUNT_SCALES = [8, 7, 6];
const GO_SCALES = [12, 9, 8, 7];
const SCALE_TICKS = 2;
const NAME_Y = 108;
const NAME_SCALE = 2;
const CONTROLS_Y = 172;
const MODIFIER_Y = 140;
const MODIFIER_ICON_SCALE = 2;
const MODIFIER_GAP = 8;
const MATCH_POINT_SCALE = 3;
const MATCH_POINT_BLINK_TICKS = 8;
const OUTLINE_COLOR = '#181425';
const COUNT_COLOR = '#ffffff';
const GO_COLOR = '#feae34';
const NAME_COLOR = '#c0cbdc';
const MATCH_POINT_COLOR = '#e43b44';
const MATCH_POINT_BLINK_COLOR = '#feae34';

// True when any player is one win short of taking the match.
export function isMatchPoint(wins, winsNeeded) {
  return Object.values(wins).some((playerWins) => playerWins === winsNeeded - 1);
}

// A number or GO! slams in big and settles to its size in whole steps, so it stays a crisp pixel block.
function slamScale(scales, ticksSinceShown) {
  return scales[Math.min(scales.length - 1, Math.floor(ticksSinceShown / SCALE_TICKS))];
}

// What the countdown shows right now, or null when there is nothing to show. Reads the scene's tick counters only.
export function roundIntroDisplay(scene) {
  if (scene.phase === 'ready') {
    const beatTicksLeft = ((scene.ticksRemaining - 1) % ROUND_COUNTDOWN_BEAT_TICKS) + 1;
    return {
      text: String(Math.ceil(scene.ticksRemaining / ROUND_COUNTDOWN_BEAT_TICKS)),
      scale: slamScale(COUNT_SCALES, ROUND_COUNTDOWN_BEAT_TICKS - beatTicksLeft),
      color: COUNT_COLOR,
    };
  }
  if (scene.phase === 'fight' && scene.ticksRemaining > 0) {
    return {
      text: 'GO!',
      scale: slamScale(GO_SCALES, ROUND_GO_TICKS - scene.ticksRemaining),
      color: GO_COLOR,
    };
  }
  return null;
}

function drawCentered(context, text, y, options) {
  drawText(context, text, SCREEN_WIDTH / 2, y, { align: 'center', outlineColor: OUTLINE_COLOR, ...options });
}

// The first round names the arena and the controls. Later rounds show MATCH POINT when someone is one win away.
export function drawRoundIntro(context, scene) {
  const display = roundIntroDisplay(scene);
  if (display) drawCentered(context, display.text, COUNT_Y, { scale: display.scale, color: display.color });
  if (scene.phase !== 'ready') return;

  if (scene.activeModifierId) {
    const name = scene.activeModifier.name;
    const iconSize = MODIFIER_ICON_SIZE * MODIFIER_ICON_SCALE;
    const textWidth = measureText(name.toUpperCase()) * NAME_SCALE;
    const left = Math.floor((SCREEN_WIDTH - iconSize - MODIFIER_GAP - textWidth) / 2);
    drawModifierIcon(context, scene.activeModifierId, left, MODIFIER_Y, MODIFIER_ICON_SCALE);
    drawText(
      context,
      name,
      left + iconSize + MODIFIER_GAP,
      MODIFIER_Y + (iconSize - TEXT_GLYPH_HEIGHT * NAME_SCALE) / 2,
      {
        scale: NAME_SCALE,
        color: GO_COLOR,
      },
    );
  }
  const firstRound = Object.values(scene.wins).every((playerWins) => playerWins === 0);
  if (firstRound) {
    drawCentered(context, scene.level.name, NAME_Y, { scale: NAME_SCALE, color: NAME_COLOR });
    const playerIds = scene.players.map((player) => player.id);
    drawPlayHints(context, playHintRows(playerIds, { shove: true }), CONTROLS_Y);
  } else if (isMatchPoint(scene.wins, scene.winsNeeded)) {
    const blinkOn = Math.floor(scene.tickCount / MATCH_POINT_BLINK_TICKS) % 2 === 0;
    drawCentered(context, 'Match point', NAME_Y, {
      scale: MATCH_POINT_SCALE,
      color: blinkOn ? MATCH_POINT_COLOR : MATCH_POINT_BLINK_COLOR,
    });
  }
}
