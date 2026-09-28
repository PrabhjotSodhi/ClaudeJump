export const LIGHT_LEVEL_MAX = 3;

function hexToRgb(hex) {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}

export function paletteColors(palette) {
  return [...new Set(Object.values(palette.ramps).flat())];
}

// A color shared by two ramps belongs to the first ramp that lists it. Stepping stops at the darkest color.
export function stepDownRamp(palette, color, steps) {
  for (const ramp of Object.values(palette.ramps)) {
    const index = ramp.indexOf(color);
    if (index !== -1) return ramp[Math.max(0, index - steps)];
  }
  return color;
}

// One column per palette color, one row per step count (0 to LIGHT_LEVEL_MAX): that color stepped down its own ramp.
// The shader finds a pixel's column by matching its color against row 0, then reads the row it needs.
export function buildLookupTexture(palette) {
  const colors = paletteColors(palette);
  const height = LIGHT_LEVEL_MAX + 1;
  const pixels = new Uint8Array(colors.length * height * 4);
  for (let steps = 0; steps < height; steps++) {
    colors.forEach((color, column) => {
      const offset = (steps * colors.length + column) * 4;
      pixels.set([...hexToRgb(stepDownRamp(palette, color, steps)), 255], offset);
    });
  }
  return { width: colors.length, height, pixels };
}
