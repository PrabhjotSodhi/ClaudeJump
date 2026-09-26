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
    this.backgroundContext = this.backgroundCanvas.getContext('2d');
    this.gameContext = this.gameCanvas.getContext('2d');
    this.uiContext = this.uiCanvas.getContext('2d');
  }

  clearGameLayer() {
    this.gameContext.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  }

  clearUiLayer() {
    this.uiContext.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  }
}
