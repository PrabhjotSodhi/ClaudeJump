import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { drawPanel } from '../ui/panel.js';
import { drawText } from '../ui/text.js';
import { findCharacter } from '../entities/characters.js';
import { drawCharacterBody, FRAME_SIZE } from '../vfx/character-body.js';
import { EYE_STIFFNESSES, GooglyEye } from '../vfx/googly-eyes.js';

const STYLE_TEST_WATER_LINE_Y = 328;

// Every block's top sits on CLUSTER_TOP_Y so the cast can hop across the cluster.
const CLUSTER_TOP_Y = 216;
const CLUSTER_BLOCKS = [
  ['block-big-0', 56, 216],
  ['block-big-1', 90, 216],
  ['block-small-0', 124, 216],
  ['block-big-1', 142, 216],
  ['block-big-0', 176, 216],
  ['block-small-1', 210, 216],
  ['block-big-1', 228, 216],
  ['block-small-1', 124, 234],
  ['block-big-1', 74, 250],
  ['block-small-0', 108, 252],
  ['block-big-0', 160, 250],
  ['block-small-0', 210, 234],
  ['block-small-1', 90, 284],
];
const GIRDER = { x: 352, y: 168, middleCount: 14 };
const CHAIN_XS = [390, 565];
const CHAIN_LINK_HEIGHT = 8;

const ROCKET = { y: 104, startX: 60, travelPixels: 460, pixelsPerTick: 1.5, flameFlickerTicks: 6 };

const SKY_COLOR = '#5a6988';
const FAR_COLOR = '#3a4466';
const MID_COLOR = '#3a4466';
const NEAR_COLOR = '#262b44';
const NEAR_RIM_COLOR = '#3a4466';
const WINDOW_COLOR = '#8b9bb4';
// Each building is [x, top, width] and runs down to the bottom of the screen.
const FAR_BUILDINGS = [
  [0, 190, 40],
  [40, 150, 18],
  [62, 176, 50],
  [120, 134, 10],
  [140, 196, 60],
  [210, 118, 22],
  [240, 170, 44],
  [300, 188, 70],
  [382, 140, 12],
  [410, 176, 56],
  [472, 124, 24],
  [500, 162, 40],
  [548, 184, 50],
  [602, 146, 20],
  [622, 180, 18],
];
const MID_BUILDINGS = [
  [0, 212, 64],
  [70, 184, 30],
  [110, 232, 80],
  [196, 200, 36],
  [250, 236, 70],
  [330, 190, 40],
  [380, 226, 90],
  [480, 196, 36],
  [520, 230, 60],
  [584, 204, 56],
];
// Sawtooth factory roofs: [x, base y, tooth count].
const MID_ROOFS = [
  [110, 232, 8],
  [380, 226, 9],
];
const ROOF_TOOTH = { width: 10, height: 6 };
// Scaffold towers: [x, top, width, bottom], braced every SCAFFOLD_BAY_HEIGHT rows.
const MID_SCAFFOLDS = [
  [150, 150, 24, 232],
  [436, 156, 22, 226],
];
const SCAFFOLD_BAY_HEIGHT = 12;
// Pipes: [left x, right x, top y].
const MID_PIPES = [
  [96, 200, 206],
  [230, 332, 214],
  [458, 484, 208],
];
const PIPE_HEIGHT = 3;
const MID_WINDOWS = [
  [78, 196, 2, 3],
  [86, 210, 2, 3],
  [206, 214, 2, 3],
  [340, 204, 2, 3],
  [490, 212, 2, 3],
];
const NEAR_BUILDINGS = [
  [0, 160, 28],
  [28, 262, 60],
  [96, 278, 70],
  [170, 252, 40],
  [216, 286, 90],
  [310, 262, 50],
  [364, 290, 80],
  [448, 258, 44],
  [496, 280, 70],
  [572, 236, 30],
  [604, 176, 36],
];
const NEAR_WINDOWS = [
  [8, 176, 3, 4],
  [16, 200, 3, 4],
  [182, 266, 3, 4],
  [458, 272, 3, 4],
  [614, 190, 3, 4],
  [622, 220, 3, 4],
];
// Mist bands: [top y, bottom y, color]. The top half of a band is sparser than the bottom half.
const MIST_BANDS_OVER_MID = [[232, 268, SKY_COLOR]];
const MIST_BANDS_OVER_NEAR = [[300, SCREEN_HEIGHT, FAR_COLOR]];

const HOP = { upSpeed: 3.2, sideSpeed: 1.1, gravity: 0.25, restTicks: 16, homeRestTicks: 44 };
const BUMP = { distance: 26, sideSpeed: 1.6, upSpeed: 2.6 };
const SQUASH = { landingTicks: 8, landing: 0.22, anticipationTicks: 5, anticipation: 0.1, stretchPerSpeed: 0.04 };
const STRETCH_MAX = 0.14;
// The composite canvas leaves room for stretch around the character's frame.
const COMPOSITE_SIZE = 48;

// Each character hops toward its partner.
const CAST = [
  { name: 'claude', partner: 'muse', homeX: 88, groundY: CLUSTER_TOP_Y, firstRestTicks: 20 },
  { name: 'muse', partner: 'claude', homeX: 140, groundY: CLUSTER_TOP_Y, firstRestTicks: 34 },
  { name: 'chatgpt', partner: 'gemini', homeX: 176, groundY: CLUSTER_TOP_Y, firstRestTicks: 26 },
  { name: 'gemini', partner: 'chatgpt', homeX: 228, groundY: CLUSTER_TOP_Y, firstRestTicks: 42 },
  { name: 'grok', partner: 'deepseek', homeX: 408, groundY: GIRDER.y, firstRestTicks: 14 },
  { name: 'deepseek', partner: 'grok', homeX: 472, groundY: GIRDER.y, firstRestTicks: 30 },
  { name: 'mistral', partner: 'deepseek', homeX: 548, groundY: GIRDER.y, firstRestTicks: 70 },
];

// Half fills every other pixel in a checkerboard, quarter fills one pixel in four.
function fillDither(context, left, top, width, height, color, density) {
  context.fillStyle = color;
  for (let y = top; y < top + height; y++) {
    for (let x = left; x < left + width; x++) {
      const filled = density === 'half' ? (x + y) % 2 === 0 : x % 2 === 0 && y % 2 === 0;
      if (filled) context.fillRect(x, y, 1, 1);
    }
  }
}

function drawMist(context, bands) {
  for (const [top, bottom, color] of bands) {
    const middle = Math.floor((top + bottom) / 2);
    fillDither(context, 0, top, SCREEN_WIDTH, middle - top, color, 'quarter');
    fillDither(context, 0, middle, SCREEN_WIDTH, bottom - middle, color, 'half');
  }
}

function fillBuildings(context, buildings, color) {
  context.fillStyle = color;
  for (const [x, top, width] of buildings) context.fillRect(x, top, width, SCREEN_HEIGHT - top);
}

function fillRects(context, rects, color) {
  context.fillStyle = color;
  for (const [x, y, width, height] of rects) context.fillRect(x, y, width, height);
}

function drawLine(context, fromX, fromY, toX, toY) {
  const steps = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY));
  for (let step = 0; step <= steps; step++) {
    const x = Math.round(fromX + ((toX - fromX) * step) / steps);
    const y = Math.round(fromY + ((toY - fromY) * step) / steps);
    context.fillRect(x, y, 1, 1);
  }
}

function drawScaffold(context, [left, top, width, bottom]) {
  const right = left + width - 1;
  context.fillRect(left, top, 1, bottom - top);
  context.fillRect(right, top, 1, bottom - top);
  for (let y = top; y + SCAFFOLD_BAY_HEIGHT <= bottom; y += SCAFFOLD_BAY_HEIGHT) {
    context.fillRect(left, y, width, 1);
    drawLine(context, left, y, right, y + SCAFFOLD_BAY_HEIGHT);
  }
}

function drawSawtoothRoof(context, [left, baseY, toothCount]) {
  for (let column = 0; column < toothCount * ROOF_TOOTH.width; column++) {
    const height = ROOF_TOOTH.height - Math.floor(((column % ROOF_TOOTH.width) * ROOF_TOOTH.height) / ROOF_TOOTH.width);
    context.fillRect(left + column, baseY - height, 1, height);
  }
}

// Three layers of city and factory, lightest and mistiest at the back. Far is a dither over the sky.
function drawBackground(context) {
  context.fillStyle = SKY_COLOR;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  for (const [x, top, width] of FAR_BUILDINGS)
    fillDither(context, x, top, width, SCREEN_HEIGHT - top, FAR_COLOR, 'half');

  fillBuildings(context, MID_BUILDINGS, MID_COLOR);
  for (const roof of MID_ROOFS) drawSawtoothRoof(context, roof);
  for (const scaffold of MID_SCAFFOLDS) drawScaffold(context, scaffold);
  for (const [left, right, top] of MID_PIPES) context.fillRect(left, top, right - left, PIPE_HEIGHT);
  fillRects(context, MID_WINDOWS, WINDOW_COLOR);
  drawMist(context, MIST_BANDS_OVER_MID);

  fillBuildings(context, NEAR_BUILDINGS, NEAR_COLOR);
  context.fillStyle = NEAR_RIM_COLOR;
  for (const [x, top, width] of NEAR_BUILDINGS) context.fillRect(x, top, width, 1);
  fillRects(context, NEAR_WINDOWS, WINDOW_COLOR);
  drawMist(context, MIST_BANDS_OVER_NEAR);
}

function drawGirder(context, sprites) {
  const { x, y, middleCount } = GIRDER;
  const middleWidth = sprites['girder-middle'].width;
  context.drawImage(sprites['girder-left'], x, y);
  for (let index = 0; index < middleCount; index++) {
    context.drawImage(sprites['girder-middle'], x + sprites['girder-left'].width + index * middleWidth, y);
  }
  context.drawImage(sprites['girder-right'], x + sprites['girder-left'].width + middleCount * middleWidth, y);
  // Chains run from the girder's top edge up and off the screen.
  for (const chainX of CHAIN_XS) {
    for (let linkY = y - CHAIN_LINK_HEIGHT; linkY > -CHAIN_LINK_HEIGHT; linkY -= CHAIN_LINK_HEIGHT) {
      context.drawImage(sprites.chain, chainX, linkY);
    }
  }
}

// Hops toward its partner, gets knocked back on a bump, then hops home and rests.
// State changes only in update(), once per tick, so the dance is the same on every run.
class HoppingCharacter {
  constructor({ sprite, homeX, groundY, firstRestTicks, eyeFramePositions }) {
    this.sprite = sprite;
    this.homeX = homeX;
    this.groundY = groundY;
    this.x = homeX;
    this.lift = 0;
    this.velocityX = 0;
    this.velocityY = 0;
    this.grounded = true;
    this.restTicks = firstRestTicks;
    this.ticksSinceLanding = SQUASH.landingTicks;
    this.mode = 'approach';
    this.eyeFramePositions = eyeFramePositions;
    this.eyes = EYE_STIFFNESSES.map((stiffness) => new GooglyEye(stiffness));
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
    drawCharacterBody(context, {
      sprite: this.sprite,
      eyeFramePositions: this.eyeFramePositions,
      eyes: this.eyes,
      centerX: center,
      bottomY: COMPOSITE_SIZE,
      width,
      height,
    });

    // The frame's bottom row is the white outline, which overlaps the top row of the block or girder below.
    const left = Math.round(this.x) - center;
    const top = this.groundY + 1 - Math.round(this.lift) - COMPOSITE_SIZE;
    renderer.gameContext.drawImage(this.composite, left, top);
  }
}

export class StyleTestScene {
  constructor({ sprites }) {
    this.sprites = sprites;
    this.waterLineY = STYLE_TEST_WATER_LINE_Y;
    this.backgroundDrawn = false;
    this.tickCount = 0;
    const characterByName = {};
    for (const { name, homeX, groundY, firstRestTicks } of CAST) {
      const { spriteName, eyeFramePositions } = findCharacter(name);
      characterByName[name] = new HoppingCharacter({
        sprite: sprites[spriteName].body,
        homeX,
        groundY,
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
    const { blocks, props } = this.sprites;
    const context = renderer.gameContext;

    renderer.clearGameLayer();
    for (const [spriteName, x, y] of CLUSTER_BLOCKS) context.drawImage(blocks[spriteName], x, y);
    drawGirder(context, blocks);
    const rocketFrame = props[`rocket-${Math.floor(this.tickCount / ROCKET.flameFlickerTicks) % 2}`];
    const rocketX = ROCKET.startX + Math.floor((this.tickCount * ROCKET.pixelsPerTick) % ROCKET.travelPixels);
    context.drawImage(rocketFrame, rocketX, ROCKET.y);
    for (const character of this.characters) character.render(renderer);

    renderer.clearUiLayer();
    drawPanel(renderer.uiContext, 16, 16, 140, 76);
    const bodyText = { scale: 1, outlineColor: null, color: '#c0cbdc' };
    drawText(renderer.uiContext, 'Style test', 28, 28, { scale: 2, outlineColor: null });
    drawText(renderer.uiContext, 'Flat light', 28, 50, bodyText);
    drawText(renderer.uiContext, 'Light from top left', 28, 60, bodyText);
    drawText(renderer.uiContext, 'Selected', 28, 70, { ...bodyText, color: '#feae34' });
  }
}
