// How many pixels, from -maxPixels to maxPixels, one band of a steam blast bulges out `ticks` into the blast. Neighboring
// bands are out of step, so the column billows as it rises. Used only for drawing.
export function steamBillow(band, ticks, maxPixels) {
  return Math.round(Math.sin(band * 1.3 - ticks * 0.6) * maxPixels);
}
