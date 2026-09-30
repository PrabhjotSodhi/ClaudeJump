// Googly eyes build their image on a canvas, so node tests give them a canvas that draws nothing.
globalThis.document ??= {
  createElement: () => ({ getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }) }),
};

export const BODY_SPRITE = { name: 'body sprite' };

export function spritesFor(characterName) {
  return { [characterName]: { body: BODY_SPRITE } };
}

// Remembers each drawImage call. The sprite draws are the ones made with BODY_SPRITE.
export function recordingContext() {
  const drawnImages = [];
  return {
    drawnImages,
    fillStyle: '',
    imageSmoothingEnabled: true,
    fillRect() {},
    drawImage(image, x, y, width, height) {
      drawnImages.push({ image, x, y, width, height });
    },
    get bodyDraws() {
      return drawnImages.filter((draw) => draw.image === BODY_SPRITE);
    },
  };
}
