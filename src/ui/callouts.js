import { CALLOUT_TICKS, CLUTCH_SECONDS, SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { drawText, measureText } from './text.js';

const CALLOUT_HEIGHT_ABOVE_WATER = 100;
const POP_SCALES = [5, 4, 3];
const POP_TICKS_PER_SCALE = 3;
const EDGE_MARGIN = 8;
const OUTLINE_COLOR = '#181425';
const COLOR_BY_TEXT = {
  'Splash!': '#2ce8f5',
  'Sniped!': '#f77622',
  'Slipped!': '#fee761',
  'Clutch!': '#e43b44',
  'Boom!': '#f77622',
};

// The word for a knockout. A clutch (little time left) beats the cause, and a knockout with no special cause is a splash.
// secondsRemaining is null once sudden death has started.
export function pickCallout({ cause, secondsRemaining }) {
  if (secondsRemaining !== null && secondsRemaining < CLUTCH_SECONDS) return 'Clutch!';
  if (cause === 'rocket') return 'Sniped!';
  if (cause === 'banana') return 'Slipped!';
  return 'Splash!';
}

// Shows one callout at a time above the sea where a player fell in. A new knockout replaces the one on screen, so
// callouts never stack. Display only: it reads events and never changes the match.
export class Callouts {
  constructor() {
    this.current = null;
  }

  attach(events, { getPlayers, getTickCount }) {
    events.on('player-fell-in-water', ({ playerId, cause = null, secondsRemaining = null }) => {
      const player = getPlayers().find((candidate) => candidate.id === playerId);
      if (!player) return;
      this.current = {
        text: pickCallout({ cause, secondsRemaining }),
        x: player.x + player.width / 2,
        startTick: getTickCount(),
      };
    });
    // Pass the bomb's fuse ran out: the holder is out in the blast, not the sea.
    events.on('player-blown-up', ({ playerId }) => {
      const player = getPlayers().find((candidate) => candidate.id === playerId);
      if (!player) return;
      this.current = { text: 'Boom!', x: player.x + player.width / 2, startTick: getTickCount() };
    });
    events.on('round-started', () => {
      this.current = null;
    });
  }

  // The callout is placed in world coordinates and follows the knockout zoom, because the UI layer is not zoomed.
  draw(context, tickCount, zoom, waterLineY) {
    if (!this.current) return;
    const ticksShown = tickCount - this.current.startTick;
    if (ticksShown >= CALLOUT_TICKS) return;

    const scale = POP_SCALES[Math.min(POP_SCALES.length - 1, Math.floor(ticksShown / POP_TICKS_PER_SCALE))];
    const halfWidth = Math.ceil((measureText(this.current.text) * scale) / 2);
    const centerX = (this.current.x - zoom.originX) * zoom.factor;
    const x = Math.round(Math.max(EDGE_MARGIN + halfWidth, Math.min(SCREEN_WIDTH - EDGE_MARGIN - halfWidth, centerX)));
    const worldY = (waterLineY - CALLOUT_HEIGHT_ABOVE_WATER - zoom.originY) * zoom.factor;
    const y = Math.round(Math.max(EDGE_MARGIN, Math.min(SCREEN_HEIGHT / 2, worldY)));
    drawText(context, this.current.text, x, y, {
      scale,
      align: 'center',
      color: COLOR_BY_TEXT[this.current.text],
      outlineColor: OUTLINE_COLOR,
    });
  }
}
