// The rules every particle effect follows, so dust, sparks, droplets and debris look like one game. Display only:
// nothing here is read by game logic.
// - Positions and speeds are floats, but a particle is always drawn on whole pixels.
// - A particle never fades with transparency. It steps down a ramp of palette colors toward the dark background, and
//   shrinks through its sizes, both by how much of its life has passed.
// - Each particle varies a little in speed, angle and life, from the effect's own seeded random, never the game's.
// - Particles sit behind the characters, except impact sparks, which draw in front.

// Ramps run from the brightest color down toward the background, all from data/palette.json.
export const RAMPS = {
  dust: ['#c0cbdc', '#8b9bb4', '#5a6988'],
  fire: ['#fee761', '#feae34', '#f77622', '#be4a2f'],
  ice: ['#ffffff', '#2ce8f5', '#0099db', '#124e89'],
  water: ['#ffffff', '#2ce8f5', '#0099db'],
};

// One step darker in the same palette ramp, for the colors effects are drawn in.
const DARKER_STEP = {
  '#e43b44': '#a22633',
  '#0099db': '#124e89',
  '#63c74d': '#3e8948',
  '#fee761': '#feae34',
  '#feae34': '#f77622',
  '#f77622': '#be4a2f',
  '#2ce8f5': '#0099db',
  '#b55088': '#68386c',
  '#f6757a': '#e43b44',
  '#c0cbdc': '#8b9bb4',
};

// A spark flashes white, shows its color, then darkens.
export function sparkRamp(color) {
  return ['#ffffff', color, DARKER_STEP[color] ?? color];
}

// A trail keeps its color and darkens, with no white flash.
export function trailRamp(color) {
  return [color, DARKER_STEP[color] ?? color];
}

// value, made up to `share` bigger or smaller at random.
export function varied(random, value, share) {
  return value * (1 + (random.next() * 2 - 1) * share);
}

// x and y are the particle's middle. drag slows it every tick, 1 for none. sizes and colors are stepped through in
// order over lifeTicks. layer is 'behind' or 'front' of the characters. A glowing particle is also drawn onto the glow
// layer.
export function createParticle({
  x,
  y,
  velocityX = 0,
  velocityY = 0,
  gravity = 0,
  drag = 1,
  lifeTicks,
  sizes,
  colors,
  layer = 'behind',
  glows = false,
}) {
  return { x, y, velocityX, velocityY, gravity, drag, age: 0, lifeTicks, sizes, colors, layer, glows };
}

// Moves a particle one tick. Returns whether it is still alive.
export function stepParticle(particle) {
  particle.velocityX *= particle.drag;
  particle.velocityY = particle.velocityY * particle.drag + particle.gravity;
  particle.x += particle.velocityX;
  particle.y += particle.velocityY;
  particle.age++;
  return particle.age < particle.lifeTicks;
}

function stepOf(steps, particle) {
  return steps[Math.min(steps.length - 1, Math.floor((particle.age / particle.lifeTicks) * steps.length))];
}

// The size and color a particle shows at its age.
export function particleLook(particle) {
  return { size: stepOf(particle.sizes, particle), color: stepOf(particle.colors, particle) };
}

// The whole pixel a float position lands on.
export function toPixel(value) {
  return Math.floor(value);
}

// A square of its size around its middle. Squares 3 pixels or wider lose their corners so they read as round.
export function drawParticle(context, particle) {
  const { size, color } = particleLook(particle);
  const left = toPixel(particle.x - size / 2);
  const top = toPixel(particle.y - size / 2);
  context.fillStyle = color;
  if (size < 3) {
    context.fillRect(left, top, size, size);
    return;
  }
  context.fillRect(left + 1, top, size - 2, size);
  context.fillRect(left, top + 1, size, size - 2);
}
