import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { drawPanel } from '../ui/panel.js';
import { drawText } from '../ui/text.js';
import { drawGooglyEye, EYE_SIZE, GooglyEye } from '../vfx/googly-eyes.js';
import { drawFullyLit, drawLightRings } from '../vfx/light-rings.js';

const TILE_SIZE = 16;
const STYLE_TEST_WATER_LINE_Y = 328;
const PLATFORM = { x: 64, y: 232, tileCount: 32 };
const TOP_TILE_BY_COLUMN = {
  2: 'top-moss',
  6: 'top-crack',
  10: 'top-moss',
  14: 'top-crack',
  17: 'top-moss',
  22: 'top-crack',
  26: 'top-moss',
  29: 'top-crack',
};
const BOTTOM_TILE_BY_COLUMN = { 4: 'bottom-crack', 15: 'bottom-crack', 25: 'bottom-crack' };

// Background colors are drawn bright because the shader darkens everything unlit by two ramp steps.
const SKY_COLOR = '#8b9bb4';
const HORIZON_COLOR = '#c0cbdc';
const HORIZON_Y = 196;
const CLOUD_COLOR = '#c0cbdc';
const CLOUD_TOP_COLOR = '#ffffff';
// Each cloud is a row of bumps on a flat base: [offset x, width, height].
const CLOUDS = [
  {
    x: 190,
    y: 132,
    bumps: [
      [0, 34, 5],
      [8, 18, 10],
      [22, 16, 7],
    ],
  },
  {
    x: 286,
    y: 50,
    bumps: [
      [0, 22, 4],
      [6, 20, 8],
      [20, 24, 6],
      [36, 18, 3],
    ],
  },
  {
    x: 508,
    y: 104,
    bumps: [
      [0, 20, 4],
      [6, 14, 8],
      [16, 16, 5],
    ],
  },
];
const FAR_CLIFF_COLOR = '#8b9bb4';
const FAR_WINDOW_COLOR = '#5a6988';
// Stepped cliff tops: each [x, top y] runs until the next x.
const FAR_CLIFF_STEPS = [
  [0, 236],
  [36, 228],
  [70, 240],
  [112, 222],
  [150, 230],
  [214, 244],
  [262, 236],
  [330, 248],
  [384, 238],
  [432, 226],
  [474, 234],
  [520, 220],
  [566, 232],
  [604, 226],
];
const FAR_TOWERS = [
  { x: 186, top: 190, width: 14, height: 44, windowY: 200 },
  { x: 446, top: 200, width: 10, height: 30, windowY: 208 },
];
const NEAR_CLIFF_COLOR = '#5a6988';
const NEAR_CLIFF_RIM_COLOR = '#8b9bb4';
const NEAR_CLIFF_LEDGE_COLOR = '#3a4466';
const NEAR_CLIFFS = [
  {
    steps: [
      [0, 170],
      [22, 180],
      [48, 194],
      [80, 212],
      [102, 240],
    ],
    endX: 120,
  },
  {
    steps: [
      [530, 236],
      [552, 214],
      [580, 196],
      [610, 182],
    ],
    endX: SCREEN_WIDTH,
  },
];
const NEAR_CLIFF_LEDGES = [
  [8, 200, 10],
  [30, 226, 12],
  [60, 250, 8],
  [88, 276, 14],
  [560, 244, 12],
  [596, 222, 10],
  [616, 262, 14],
];

const LAMP_XS = [70, 560];
const LAMP_LIGHT_RADII = [88, 52];
const ROCKET_LIGHT_RADII = [44, 24];
const ROCKET = { y: 104, startX: 60, travelPixels: 460, pixelsPerTick: 1.5, flameFlickerTicks: 6 };
const FOG_STRENGTH = 0.8;

const HOP = { upSpeed: 3.2, sideSpeed: 1.1, gravity: 0.25, restTicks: 16, homeRestTicks: 44 };
const BUMP = { distance: 26, sideSpeed: 1.6, upSpeed: 2.6 };
const SQUASH = { landingTicks: 8, landing: 0.22, anticipationTicks: 5, anticipation: 0.1, stretchPerSpeed: 0.04 };
const STRETCH_MAX = 0.14;
// The body frame is 32x32. The composite canvas leaves room for stretch.
const FRAME_SIZE = 32;
const COMPOSITE_SIZE = 48;
// One per eye. The left eye is a little stiffer, so the pupils drift apart like real googly eyes.
const PUPIL_STIFFNESS = [0.16, 0.12];

// Each character hops toward its partner. Eyes are the top left of each eye in the 32x32 body frame, placed so they
// leave the character's signature shape visible.
const CAST = [
  {
    name: 'claude',
    partner: 'muse',
    homeX: 96,
    firstRestTicks: 20,
    eyeFramePositions: [
      [7, 8],
      [16, 8],
    ],
  },
  {
    name: 'muse',
    partner: 'claude',
    homeX: 160,
    firstRestTicks: 34,
    eyeFramePositions: [
      [7, 6],
      [16, 6],
    ],
  },
  {
    name: 'chatgpt',
    partner: 'gemini',
    homeX: 234,
    firstRestTicks: 26,
    eyeFramePositions: [
      [6, 5],
      [17, 5],
    ],
  },
  {
    name: 'gemini',
    partner: 'chatgpt',
    homeX: 298,
    firstRestTicks: 42,
    eyeFramePositions: [
      [7, 11],
      [16, 11],
    ],
  },
  {
    name: 'grok',
    partner: 'deepseek',
    homeX: 384,
    firstRestTicks: 14,
    eyeFramePositions: [
      [4, 8],
      [12, 5],
    ],
  },
  {
    name: 'deepseek',
    partner: 'grok',
    homeX: 456,
    firstRestTicks: 30,
    eyeFramePositions: [
      [4, 13],
      [12, 13],
    ],
  },
  {
    name: 'mistral',
    partner: 'deepseek',
    homeX: 528,
    firstRestTicks: 70,
    eyeFramePositions: [
      [7, 12],
      [18, 12],
    ],
  },
];

function drawCloud(context, { x, y, bumps }) {
  for (const [offsetX, width, height] of bumps) {
    const left = x + offsetX;
    const top = y - height;
    context.fillStyle = CLOUD_COLOR;
    context.fillRect(left + 1, top, width - 2, height);
    context.fillRect(left, top + 1, width, height - 1);
    context.fillStyle = CLOUD_TOP_COLOR;
    context.fillRect(left + 1, top, width - 2, 1);
    context.fillRect(left, top + 1, 1, 1);
  }
}

// Each step is [x, top y] and runs until the next step's x, or endX for the last one.
function drawSteps(context, steps, endX, color) {
  context.fillStyle = color;
  steps.forEach(([x, top], index) => {
    const nextX = steps[index + 1]?.[0] ?? endX;
    context.fillRect(x, top, nextX - x, SCREEN_HEIGHT - top);
  });
}

function drawBackground(context) {
  context.fillStyle = SKY_COLOR;
  context.fillRect(0, 0, SCREEN_WIDTH, HORIZON_Y);
  context.fillStyle = HORIZON_COLOR;
  context.fillRect(0, HORIZON_Y, SCREEN_WIDTH, SCREEN_HEIGHT - HORIZON_Y);
  // A two row checker blends the sky into the horizon.
  for (let x = 0; x < SCREEN_WIDTH; x += 2) {
    context.fillRect(x, HORIZON_Y - 2, 1, 1);
    context.fillRect(x + 1, HORIZON_Y - 1, 1, 1);
  }
  for (const cloud of CLOUDS) drawCloud(context, cloud);

  drawSteps(context, FAR_CLIFF_STEPS, SCREEN_WIDTH, FAR_CLIFF_COLOR);
  for (const { x, top, width, height, windowY } of FAR_TOWERS) {
    context.fillStyle = FAR_CLIFF_COLOR;
    context.fillRect(x, top + 2, width, height);
    for (let merlonX = x; merlonX < x + width; merlonX += 4) context.fillRect(merlonX, top, 2, 2);
    context.fillStyle = FAR_WINDOW_COLOR;
    context.fillRect(x + Math.floor(width / 2) - 1, windowY, 2, 4);
  }

  for (const { steps, endX } of NEAR_CLIFFS) {
    drawSteps(context, steps, endX, NEAR_CLIFF_COLOR);
    context.fillStyle = NEAR_CLIFF_RIM_COLOR;
    steps.forEach(([x, top], index) => {
      const nextX = steps[index + 1]?.[0] ?? endX;
      context.fillRect(x, top, nextX - x, 1);
      // A step that rises to the right shows its lit left face.
      const previousTop = steps[index - 1]?.[1];
      if (previousTop > top) context.fillRect(x, top, 1, previousTop - top);
    });
  }
  context.fillStyle = NEAR_CLIFF_LEDGE_COLOR;
  for (const [x, y, width] of NEAR_CLIFF_LEDGES) context.fillRect(x, y, width, 1);
}

function platformTileName(row, column) {
  if (row === 0) return TOP_TILE_BY_COLUMN[column] ?? 'top';
  return BOTTOM_TILE_BY_COLUMN[column] ?? 'bottom';
}

// Hops toward its partner, gets knocked back on a bump, then hops home and rests.
// State changes only in update(), once per tick, so the dance is the same on every run.
class HoppingCharacter {
  constructor({ sprite, homeX, firstRestTicks, eyeFramePositions }) {
    this.sprite = sprite;
    this.homeX = homeX;
    this.x = homeX;
    this.lift = 0;
    this.velocityX = 0;
    this.velocityY = 0;
    this.grounded = true;
    this.restTicks = firstRestTicks;
    this.ticksSinceLanding = SQUASH.landingTicks;
    this.mode = 'approach';
    this.eyeFramePositions = eyeFramePositions;
    this.eyes = PUPIL_STIFFNESS.map((stiffness) => new GooglyEye(stiffness));
    this.composite = document.createElement('canvas');
    this.composite.width = COMPOSITE_SIZE;
    this.composite.height = COMPOSITE_SIZE;
  }

  hop(directionX, sideSpeed, upSpeed) {
    this.velocityX = directionX * sideSpeed;
    this.velocityY = -upSpeed;
    this.grounded = false;
    for (const eye of this.eyes) eye.jump();
  }

  bump(directionX) {
    this.hop(directionX, BUMP.sideSpeed, BUMP.upSpeed);
    this.mode = 'retreat';
    for (const eye of this.eyes) eye.hit(directionX);
  }

  update() {
    this.ticksSinceLanding++;
    if (this.grounded) {
      this.restTicks--;
      if (this.restTicks <= 0) {
        const targetX = this.mode === 'approach' ? this.partner.x : this.homeX;
        this.hop(Math.sign(targetX - this.x), HOP.sideSpeed, HOP.upSpeed);
      }
    } else {
      this.velocityY += HOP.gravity;
      this.x += this.velocityX;
      this.lift -= this.velocityY;
      if (this.lift <= 0) this.land();
    }
    for (const eye of this.eyes) eye.update(this.velocityX, this.velocityY);
  }

  land() {
    this.lift = 0;
    this.velocityX = 0;
    this.velocityY = 0;
    this.grounded = true;
    this.ticksSinceLanding = 0;
    this.restTicks = HOP.restTicks;
    const hopLength = HOP.sideSpeed * ((2 * HOP.upSpeed) / HOP.gravity);
    if (this.mode === 'retreat' && Math.abs(this.x - this.homeX) < hopLength / 2) {
      this.mode = 'approach';
      this.restTicks = HOP.homeRestTicks;
    }
  }

  // Positive squashes the body flat, negative stretches it tall.
  squashAmount() {
    if (this.ticksSinceLanding < SQUASH.landingTicks) {
      return (SQUASH.landing * (SQUASH.landingTicks - this.ticksSinceLanding)) / SQUASH.landingTicks;
    }
    if (this.grounded && this.restTicks <= SQUASH.anticipationTicks) return SQUASH.anticipation;
    if (!this.grounded) return -Math.min(Math.abs(this.velocityY) * SQUASH.stretchPerSpeed, STRETCH_MAX);
    return 0;
  }

  render(renderer) {
    const squash = this.squashAmount();
    const scaleX = 1 + squash;
    const scaleY = 1 - squash;
    const width = Math.round(FRAME_SIZE * scaleX);
    const height = Math.round(FRAME_SIZE * scaleY);
    const center = COMPOSITE_SIZE / 2;

    const context = this.composite.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, COMPOSITE_SIZE, COMPOSITE_SIZE);
    context.drawImage(this.sprite, center - Math.floor(width / 2), COMPOSITE_SIZE - height, width, height);
    // Eyes keep their size and ride on the squashed body, measured from the bottom center of the frame.
    this.eyeFramePositions.forEach(([frameX, frameY], index) => {
      const eyeCenterX = center + (frameX + EYE_SIZE / 2 - FRAME_SIZE / 2) * scaleX;
      const eyeCenterY = COMPOSITE_SIZE + (frameY + EYE_SIZE / 2 - FRAME_SIZE) * scaleY;
      const eyeX = Math.round(eyeCenterX - EYE_SIZE / 2);
      const eyeY = Math.round(eyeCenterY - EYE_SIZE / 2);
      drawGooglyEye(context, this.eyes[index], eyeX, eyeY);
    });

    // The frame's bottom row is the white outline, which overlaps the top row of the tile below.
    const left = Math.round(this.x) - center;
    const top = PLATFORM.y + 1 - Math.round(this.lift) - COMPOSITE_SIZE;
    renderer.gameContext.drawImage(this.composite, left, top);
    drawFullyLit(renderer.lightContext, this.composite, left, top);
  }
}

export class StyleTestScene {
  constructor({ sprites }) {
    this.sprites = sprites;
    this.waterLineY = STYLE_TEST_WATER_LINE_Y;
    this.lighting = { fogStrength: FOG_STRENGTH };
    this.backgroundDrawn = false;
    this.tickCount = 0;
    const characterByName = {};
    for (const { name, homeX, firstRestTicks, eyeFramePositions } of CAST) {
      characterByName[name] = new HoppingCharacter({
        sprite: sprites[name].body,
        homeX,
        firstRestTicks,
        eyeFramePositions,
      });
    }
    for (const { name, partner } of CAST) characterByName[name].partner = characterByName[partner];
    this.characters = Object.values(characterByName);
    // Dev-mode snapshots read these.
    this.phase = 'style';
    this.wins = {};
    this.players = [];
  }

  update() {
    this.tickCount++;
    for (const character of this.characters) character.update();
    for (const character of this.characters) {
      const { partner } = character;
      if (character.mode === 'approach' && Math.abs(partner.x - character.x) < BUMP.distance) {
        const awayX = Math.sign(character.x - partner.x);
        character.bump(awayX);
        partner.bump(-awayX);
      }
    }
  }

  render(renderer) {
    if (!this.backgroundDrawn) {
      renderer.updateBackground(drawBackground);
      this.backgroundDrawn = true;
    }
    const { tiles, props } = this.sprites;
    const context = renderer.gameContext;

    renderer.clearGameLayer();
    renderer.clearLightLayer();
    for (let row = 0; row < 2; row++) {
      for (let column = 0; column < PLATFORM.tileCount; column++) {
        context.drawImage(
          tiles[platformTileName(row, column)],
          PLATFORM.x + column * TILE_SIZE,
          PLATFORM.y + row * TILE_SIZE,
        );
      }
    }
    const lampY = PLATFORM.y - props.lamp.height + 1;
    for (const lampX of LAMP_XS) {
      context.drawImage(props.lamp, lampX, lampY);
      drawLightRings(renderer.lightContext, lampX + 5, lampY + 5, LAMP_LIGHT_RADII, this.tickCount);
    }
    const rocketFrame = props[`rocket-${Math.floor(this.tickCount / ROCKET.flameFlickerTicks) % 2}`];
    const rocketX = ROCKET.startX + Math.floor((this.tickCount * ROCKET.pixelsPerTick) % ROCKET.travelPixels);
    context.drawImage(rocketFrame, rocketX, ROCKET.y);
    drawLightRings(
      renderer.lightContext,
      rocketX + rocketFrame.width / 2,
      ROCKET.y + rocketFrame.height / 2,
      ROCKET_LIGHT_RADII,
      this.tickCount,
    );
    for (const character of this.characters) character.render(renderer);

    renderer.clearUiLayer();
    drawPanel(renderer.uiContext, 16, 16, 140, 76);
    const bodyText = { scale: 1, outlineColor: null, color: '#c0cbdc' };
    drawText(renderer.uiContext, 'Style test', 28, 28, { scale: 2, outlineColor: null });
    drawText(renderer.uiContext, 'Palette lighting', 28, 50, bodyText);
    drawText(renderer.uiContext, 'Light from top left', 28, 60, bodyText);
    drawText(renderer.uiContext, 'Selected', 28, 70, { ...bodyText, color: '#feae34' });
  }
}
