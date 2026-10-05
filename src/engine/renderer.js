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
    this.glowCanvas = createLayerCanvas();
    this.uiCanvas = createLayerCanvas();
    this.backgroundContext = this.backgroundCanvas.getContext('2d');
    this.gameContext = this.gameCanvas.getContext('2d');
    this.glowContext = this.glowCanvas.getContext('2d');
    this.uiContext = this.uiCanvas.getContext('2d');
    this.backgroundChanged = false;
    // Whole pixels the shader moves the background and game layers by. The UI layer never moves.
    this.shakeOffset = { x: 0, y: 0 };
    // The world is drawn `factor` times larger, starting at this whole pixel of the 640x360 layers. The UI layer never zooms.
    this.zoom = { factor: 1, originX: 0, originY: 0 };
    this.seaRippleBytes = null;
    // Set by main each frame: the on-screen touch controls are showing.
    this.touchActive = false;
  }

  updateBackground(draw) {
    draw(this.backgroundContext);
    this.backgroundChanged = true;
  }

  // Clears the glow layer too. Entities draw their bright pixels onto glowContext as well as the game layer, and only
  // those pixels glow.
  clearGameLayer() {
    this.gameContext.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    this.glowContext.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  }

  clearUiLayer() {
    this.uiContext.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  }
}
