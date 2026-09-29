import { SCREEN_HEIGHT, SCREEN_WIDTH } from './config.js';

function createLayerCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = SCREEN_WIDTH;
  canvas.height = SCREEN_HEIGHT;
  return canvas;
}

export class Renderer {
  constructor() {
    this.backgroundCanvas = createLayerCanvas();
    this.gameCanvas = createLayerCanvas();
    this.uiCanvas = createLayerCanvas();
    this.lightCanvas = createLayerCanvas();
    this.backgroundContext = this.backgroundCanvas.getContext('2d');
    this.gameContext = this.gameCanvas.getContext('2d');
    this.uiContext = this.uiCanvas.getContext('2d');
    this.lightContext = this.lightCanvas.getContext('2d');
    this.backgroundChanged = false;
  }

  updateBackground(draw) {
    draw(this.backgroundContext);
    this.backgroundChanged = true;
  }

  clearGameLayer() {
    this.gameContext.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  }

  // Black is light level 0. See vfx/light-rings.js for how levels are stored.
  clearLightLayer() {
    this.lightContext.fillStyle = 'rgb(0, 0, 0)';
    this.lightContext.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  }

  clearUiLayer() {
    this.uiContext.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  }
}
