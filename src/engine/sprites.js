function hexToRgb(hex) {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}

// rows is an array of equal-length strings. Each character is a key into colorByKey, whose value is a hex color or null for empty.
export function gridToPixels(rows, colorByKey) {
  const width = rows[0].length;
  const data = new Uint8ClampedArray(width * rows.length * 4);
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`Sprite row ${y} is ${row.length} wide, expected ${width}`);
    [...row].forEach((key, x) => {
      if (!(key in colorByKey)) throw new Error(`Sprite key "${key}" at ${x},${y} is not in the color map`);
      if (colorByKey[key] !== null) data.set([...hexToRgb(colorByKey[key]), 255], (y * width + x) * 4);
    });
  });
  return { width, height: rows.length, data };
}

function gridToCanvas(rows, colorByKey) {
  const { width, height, data } = gridToPixels(rows, colorByKey);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0);
  return canvas;
}

// Returns { frameName: canvas } for one sprite file.
export async function loadSpriteFile(path) {
  const { colors, frames } = await fetch(path).then((response) => response.json());
  const canvasByFrameName = {};
  for (const [frameName, rows] of Object.entries(frames)) canvasByFrameName[frameName] = gridToCanvas(rows, colors);
  return canvasByFrameName;
}
