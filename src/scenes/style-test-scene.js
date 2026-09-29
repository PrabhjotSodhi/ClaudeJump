import { drawCityBackground } from '../levels/city-background.js';
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
      renderer.updateBackground(drawCityBackground);
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
