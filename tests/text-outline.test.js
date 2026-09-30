import assert from 'node:assert/strict';
import { test } from 'node:test';
import { drawText, TEXT_OUTLINE_MARGIN, textOutlineMargin } from '../src/ui/text.js';

// Glyphs are drawn from small canvases. These stand-ins record where each outline copy of one glyph lands.
function drawnGlyphPositions(scale) {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: () => ({ getContext: () => ({ fillRect() {} }) }),
  };
  const positions = [];
  const context = { drawImage: (canvas, x, y) => positions.push([x, y]) };
  try {
    drawText(context, 'I', 100, 50, { scale, outlineColor: '#141428' });
  } finally {
    globalThis.document = previousDocument;
  }
  return positions;
}

test('outlined 1x text puts its outline right against the glyph', () => {
  const positions = drawnGlyphPositions(1);
  const glyph = positions[positions.length - 1];
  for (const [x, y] of positions.slice(0, -1)) {
    assert.ok(Math.abs(x - glyph[0]) <= 1 && Math.abs(y - glyph[1]) <= 1);
  }
});

test('outlined 2x and 3x text keep a 2 pixel outline', () => {
  for (const scale of [2, 3]) {
    const positions = drawnGlyphPositions(scale);
    const glyph = positions[positions.length - 1];
    const farthest = Math.max(...positions.map(([x, y]) => Math.max(Math.abs(x - glyph[0]), Math.abs(y - glyph[1]))));
    assert.equal(farthest, 2);
  }
});

test('the outline margin matches what is drawn at each scale', () => {
  assert.equal(textOutlineMargin(1), 1);
  assert.equal(textOutlineMargin(2), 2);
  assert.equal(textOutlineMargin(3), 2);
  assert.equal(TEXT_OUTLINE_MARGIN, textOutlineMargin(2));
});
