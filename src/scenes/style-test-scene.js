import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { WATER_LINE_Y } from '../levels/versus-arena.js';
import { drawPanel } from '../ui/panel.js';
import { drawText } from '../ui/text.js';
import { drawLightRings } from '../vfx/light-rings.js';

const TILE_SIZE = 16;
const PLATFORM = { x: 144, y: 232, tileCount: 22 };
const SKY_COLOR = '#5a6988';
const SHAPE_COLOR = '#3a4466';
const BACKGROUND_SHAPES = [
  { x: 36, y: 150, width: 44, height: 200 },
  { x: 96, y: 196, width: 60, height: 150 },
  { x: 470, y: 138, width: 52, height: 210 },
  { x: 536, y: 204, width: 72, height: 150 },
  { x: 0, y: 268, width: 640, height: 92 },
];
const LAMP_X = 352;
// The character frame is 32x32 with its feet 2 rows above the bottom edge. The white outline overlaps the tile below.
const CLAUDE_OFFSET_X = -34;
const CLAUDE_OFFSET_Y = -31;
const LAMP_LIGHT_RADII = [84, 54, 32];
const ROCKET_LIGHT_RADII = [56, 36, 18];
const ROCKET = { y: 104, startX: 60, travelPixels: 460, pixelsPerTick: 1.5, flameFlickerTicks: 6 };
const IDLE_FRAME_TICKS = 30;
const FOG_STRENGTH = 1.2;

function drawBackground(context) {
  context.fillStyle = SKY_COLOR;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  context.fillStyle = SHAPE_COLOR;
  for (const { x, y, width, height } of BACKGROUND_SHAPES) context.fillRect(x, y, width, height);
}

function tileFrameName(row, column) {
  if (row === 0) return column % 6 === 2 ? 'top-rivets' : 'top';
  return column % 9 === 4 ? 'bottom-crack' : 'bottom';
}

export class StyleTestScene {
  constructor({ sprites }) {
    this.sprites = sprites;
    this.waterLineY = WATER_LINE_Y;
    this.lighting = { fogStrength: FOG_STRENGTH };
    this.backgroundDrawn = false;
    this.tickCount = 0;
    // Dev-mode snapshots read these.
    this.phase = 'style';
    this.wins = {};
    this.players = [];
  }

  update() {
    this.tickCount++;
  }

  render(renderer) {
    if (!this.backgroundDrawn) {
      renderer.updateBackground(drawBackground);
      this.backgroundDrawn = true;
    }
    const { claude, tiles, props } = this.sprites;
    const context = renderer.gameContext;

    renderer.clearGameLayer();
    for (let row = 0; row < 2; row++) {
      for (let column = 0; column < PLATFORM.tileCount; column++) {
        context.drawImage(
          tiles[tileFrameName(row, column)],
          PLATFORM.x + column * TILE_SIZE,
          PLATFORM.y + row * TILE_SIZE,
        );
      }
    }
    const lampY = PLATFORM.y - props.lamp.height + 1;
    context.drawImage(props.lamp, LAMP_X, lampY);
    context.drawImage(
      claude[`idle-${Math.floor(this.tickCount / IDLE_FRAME_TICKS) % 2}`],
      LAMP_X + CLAUDE_OFFSET_X,
      PLATFORM.y + CLAUDE_OFFSET_Y,
    );
    const rocketFrame = props[`rocket-${Math.floor(this.tickCount / ROCKET.flameFlickerTicks) % 2}`];
    const rocketX = ROCKET.startX + Math.floor((this.tickCount * ROCKET.pixelsPerTick) % ROCKET.travelPixels);
    context.drawImage(rocketFrame, rocketX, ROCKET.y);

    renderer.clearLightLayer();
    drawLightRings(renderer.lightContext, LAMP_X + 5, lampY + 5, LAMP_LIGHT_RADII, this.tickCount);
    drawLightRings(
      renderer.lightContext,
      rocketX + rocketFrame.width / 2,
      ROCKET.y + rocketFrame.height / 2,
      ROCKET_LIGHT_RADII,
      this.tickCount,
    );

    renderer.clearUiLayer();
    drawPanel(renderer.uiContext, 16, 16, 140, 76);
    const bodyText = { scale: 1, outlineColor: null, color: '#c0cbdc' };
    drawText(renderer.uiContext, 'Style test', 28, 28, { scale: 2, outlineColor: null });
    drawText(renderer.uiContext, 'Palette lighting', 28, 50, bodyText);
    drawText(renderer.uiContext, 'Light from top left', 28, 60, bodyText);
    drawText(renderer.uiContext, 'Selected', 28, 70, { ...bodyText, color: '#feae34' });
  }
}
