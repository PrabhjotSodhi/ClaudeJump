import { SCREEN_WIDTH } from '../engine/config.js';
import { SeededRandom } from '../engine/seeded-random.js';

// Render only. Cloud positions come from the tick count and a fixed seed, so every machine draws the same sky.
// Survival has no arena of its own, so it passes the 'rooftops' name.
const OUTDOOR_BACKGROUND_NAMES = new Set(['harbor', 'rooftops', 'pier', 'lighthouse', 'shipyard', 'bridge', 'quarry']);
const CLOUD_SEED = 28;
const SKY_TOP_Y = 8;
const SKY_BOTTOM_Y = 200;

const SHAPES = {
  small: {
    width: 24,
    rects: [
      [6, 0, 12, 3],
      [0, 3, 24, 4],
    ],
    underside: [2, 6, 20, 1],
  },
  medium: {
    width: 40,
    rects: [
      [10, 0, 20, 4],
      [0, 4, 40, 6],
    ],
    underside: [3, 9, 34, 1],
  },
  large: {
    width: 56,
    rects: [
      [8, 4, 18, 5],
      [24, 0, 22, 9],
      [0, 9, 56, 7],
    ],
    underside: [4, 14, 48, 2],
  },
};
const DEPTHS = [
  { count: 3, shape: 'small', color: '#8b9bb4', speed: 0.1 },
  { count: 3, shape: 'medium', color: '#8b9bb4', speed: 0.2 },
  { count: 2, shape: 'large', color: '#c0cbdc', speed: 0.3, undersideColor: '#8b9bb4' },
];

const random = new SeededRandom(CLOUD_SEED);
const CLOUDS = DEPTHS.flatMap((depth) =>
  Array.from({ length: depth.count }, () => ({
    depth,
    shape: SHAPES[depth.shape],
    startX: Math.floor(random.next() * SCREEN_WIDTH),
    y: SKY_TOP_Y + Math.floor(random.next() * (SKY_BOTTOM_Y - SKY_TOP_Y - 40)),
  })),
);

export function drawClouds(context, backgroundName, tick) {
  if (!OUTDOOR_BACKGROUND_NAMES.has(backgroundName)) return;
  for (const cloud of CLOUDS) {
    const { shape, depth } = cloud;
    // A cloud drifts right and re-enters on the left once it is fully off the right edge.
    const travel = SCREEN_WIDTH + shape.width;
    const x = (((Math.floor(cloud.startX + depth.speed * tick) % travel) + travel) % travel) - shape.width;
    context.fillStyle = depth.color;
    for (const [rectX, rectY, width, height] of shape.rects) {
      context.fillRect(x + rectX, cloud.y + rectY, width, height);
    }
    if (depth.undersideColor) {
      const [rectX, rectY, width, height] = shape.underside;
      context.fillStyle = depth.undersideColor;
      context.fillRect(x + rectX, cloud.y + rectY, width, height);
    }
  }
}
