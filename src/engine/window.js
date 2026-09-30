import { SCREEN_HEIGHT, SCREEN_WIDTH, SEA_COLUMN_COUNT } from './config.js';
import { fitPortraitLayout } from './portrait-layout.js';
import { fitScreen, isPortraitOnTouchDevice } from './screen-fit.js';

const TEXTURE_UNIT_BY_LAYER_NAME = { background: 0, game: 1, ui: 2 };
const SEA_TEXTURE_UNIT = 3;

function compileShader(webglContext, type, source) {
  const shader = webglContext.createShader(type);
  webglContext.shaderSource(shader, source);
  webglContext.compileShader(shader);
  if (!webglContext.getShaderParameter(shader, webglContext.COMPILE_STATUS)) {
    throw new Error(webglContext.getShaderInfoLog(shader));
  }
  return shader;
}

function createProgram(webglContext, vertexShaderSource, fragmentShaderSource) {
  const program = webglContext.createProgram();
  webglContext.attachShader(program, compileShader(webglContext, webglContext.VERTEX_SHADER, vertexShaderSource));
  webglContext.attachShader(program, compileShader(webglContext, webglContext.FRAGMENT_SHADER, fragmentShaderSource));
  webglContext.linkProgram(program);
  webglContext.useProgram(program);
  return program;
}

// The page pads the body by the safe-area insets, so the padding is what the canvas must stay out of.
export function readSafeAreaInsets() {
  const style = getComputedStyle(document.body);
  return {
    left: parseFloat(style.paddingLeft),
    right: parseFloat(style.paddingRight),
    top: parseFloat(style.paddingTop),
    bottom: parseFloat(style.paddingBottom),
  };
}

function placeCanvas(canvas, { deviceWidth, deviceHeight, cssWidth, cssHeight, cssLeft, cssTop }) {
  canvas.width = deviceWidth;
  canvas.height = deviceHeight;
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  canvas.style.left = `${cssLeft}px`;
  canvas.style.top = `${cssTop}px`;
}

// Returns the portrait layout while a touch device is held upright, otherwise null.
function resizeToFitWindow(canvas, webglContext, { controlsCanvas, coarsePointerQuery }) {
  const devicePixelRatio = window.devicePixelRatio || 1;
  const insets = document.fullscreenElement ? undefined : readSafeAreaInsets();
  const isPortrait = isPortraitOnTouchDevice({
    width: innerWidth,
    height: innerHeight,
    hasCoarsePointer: coarsePointerQuery.matches,
  });
  document.documentElement.classList.toggle('portrait', isPortrait);

  let portraitLayout = null;
  let gameFit;
  if (isPortrait) {
    portraitLayout = fitPortraitLayout({
      width: innerWidth,
      height: innerHeight,
      devicePixelRatio,
      insets,
    });
    gameFit = portraitLayout.game;
    const { controls } = portraitLayout;
    controlsCanvas.width = controls.logicalWidth;
    controlsCanvas.height = controls.logicalHeight;
    controlsCanvas.style.width = `${controls.cssWidth}px`;
    controlsCanvas.style.height = `${controls.cssHeight}px`;
    controlsCanvas.style.left = `${controls.cssLeft}px`;
    controlsCanvas.style.top = `${controls.cssTop}px`;
  } else {
    gameFit = fitScreen({ width: innerWidth, height: innerHeight, devicePixelRatio, insets });
  }
  placeCanvas(canvas, gameFit);
  // One game pixel in CSS pixels, for page decoration that has to line up with the game's pixels.
  document.documentElement.style.setProperty('--game-pixel', `${gameFit.cssWidth / SCREEN_WIDTH}px`);
  webglContext.viewport(0, 0, canvas.width, canvas.height);
  return portraitLayout;
}

// controlsCanvas is the portrait controls panel.
export function createWindow(canvas, vertexShaderSource, fragmentShaderSource, { controlsCanvas }) {
  const webglContext = canvas.getContext('webgl', { antialias: false });
  if (!webglContext) return null;
  const program = createProgram(webglContext, vertexShaderSource, fragmentShaderSource);

  webglContext.bindBuffer(webglContext.ARRAY_BUFFER, webglContext.createBuffer());
  webglContext.bufferData(
    webglContext.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    webglContext.STATIC_DRAW,
  );
  const positionAttributeLocation = webglContext.getAttribLocation(program, 'a_position');
  webglContext.enableVertexAttribArray(positionAttributeLocation);
  webglContext.vertexAttribPointer(positionAttributeLocation, 2, webglContext.FLOAT, false, 0, 0);

  for (const [layerName, textureUnit] of Object.entries(TEXTURE_UNIT_BY_LAYER_NAME)) {
    webglContext.activeTexture(webglContext.TEXTURE0 + textureUnit);
    webglContext.bindTexture(webglContext.TEXTURE_2D, webglContext.createTexture());
    webglContext.texParameteri(webglContext.TEXTURE_2D, webglContext.TEXTURE_MIN_FILTER, webglContext.NEAREST);
    webglContext.texParameteri(webglContext.TEXTURE_2D, webglContext.TEXTURE_MAG_FILTER, webglContext.NEAREST);
    webglContext.texParameteri(webglContext.TEXTURE_2D, webglContext.TEXTURE_WRAP_S, webglContext.CLAMP_TO_EDGE);
    webglContext.texParameteri(webglContext.TEXTURE_2D, webglContext.TEXTURE_WRAP_T, webglContext.CLAMP_TO_EDGE);
    webglContext.uniform1i(webglContext.getUniformLocation(program, `u_${layerName}Layer`), textureUnit);
  }
  const flatSea = new Uint8Array(SEA_COLUMN_COUNT * 4).fill(128);
  webglContext.activeTexture(webglContext.TEXTURE0 + SEA_TEXTURE_UNIT);
  webglContext.bindTexture(webglContext.TEXTURE_2D, webglContext.createTexture());
  webglContext.texParameteri(webglContext.TEXTURE_2D, webglContext.TEXTURE_MIN_FILTER, webglContext.NEAREST);
  webglContext.texParameteri(webglContext.TEXTURE_2D, webglContext.TEXTURE_MAG_FILTER, webglContext.NEAREST);
  webglContext.texParameteri(webglContext.TEXTURE_2D, webglContext.TEXTURE_WRAP_S, webglContext.CLAMP_TO_EDGE);
  webglContext.texParameteri(webglContext.TEXTURE_2D, webglContext.TEXTURE_WRAP_T, webglContext.CLAMP_TO_EDGE);
  webglContext.uniform1i(webglContext.getUniformLocation(program, 'u_seaHeights'), SEA_TEXTURE_UNIT);
  webglContext.uniform2f(webglContext.getUniformLocation(program, 'u_resolution'), SCREEN_WIDTH, SCREEN_HEIGHT);
  const waterLineUniformLocation = webglContext.getUniformLocation(program, 'u_waterLine');
  const shakeOffsetUniformLocation = webglContext.getUniformLocation(program, 'u_shakeOffset');
  const zoomFactorUniformLocation = webglContext.getUniformLocation(program, 'u_zoomFactor');
  const zoomOriginUniformLocation = webglContext.getUniformLocation(program, 'u_zoomOrigin');
  const timeUniformLocation = webglContext.getUniformLocation(program, 'u_time');

  const coarsePointerQuery = matchMedia('(pointer: coarse)');
  let portraitLayout = null;
  function resize() {
    portraitLayout = resizeToFitWindow(canvas, webglContext, { controlsCanvas, coarsePointerQuery });
  }
  addEventListener('resize', resize);
  // Entering or leaving fullscreen usually fires 'resize' too, but this covers browsers where it doesn't.
  document.addEventListener('fullscreenchange', resize);
  resize();

  function uploadLayer(layerName, layerCanvas) {
    webglContext.activeTexture(webglContext.TEXTURE0 + TEXTURE_UNIT_BY_LAYER_NAME[layerName]);
    webglContext.texImage2D(
      webglContext.TEXTURE_2D,
      0,
      webglContext.RGBA,
      webglContext.RGBA,
      webglContext.UNSIGNED_BYTE,
      layerCanvas,
    );
  }

  return {
    // The portrait layout while a touch device is held upright, otherwise null.
    get portraitLayout() {
      return portraitLayout;
    },
    render({ backgroundCanvas, gameCanvas, uiCanvas, shakeOffset, zoom, seaRippleBytes, waterLineY, timeSeconds }) {
      if (backgroundCanvas) uploadLayer('background', backgroundCanvas);
      uploadLayer('game', gameCanvas);
      uploadLayer('ui', uiCanvas);
      webglContext.activeTexture(webglContext.TEXTURE0 + SEA_TEXTURE_UNIT);
      webglContext.texImage2D(
        webglContext.TEXTURE_2D,
        0,
        webglContext.RGBA,
        SEA_COLUMN_COUNT,
        1,
        0,
        webglContext.RGBA,
        webglContext.UNSIGNED_BYTE,
        seaRippleBytes ?? flatSea,
      );
      webglContext.uniform2f(shakeOffsetUniformLocation, shakeOffset.x, shakeOffset.y);
      webglContext.uniform1f(zoomFactorUniformLocation, zoom.factor);
      webglContext.uniform2f(zoomOriginUniformLocation, zoom.originX, zoom.originY);
      webglContext.uniform1f(waterLineUniformLocation, waterLineY);
      webglContext.uniform1f(timeUniformLocation, timeSeconds);
      webglContext.drawArrays(webglContext.TRIANGLE_STRIP, 0, 4);
    },
  };
}
