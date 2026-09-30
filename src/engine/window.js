import { SCREEN_HEIGHT, SCREEN_WIDTH, SEA_COLUMN_COUNT } from './config.js';
import { fitScreen } from './screen-fit.js';

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

function resizeToFitWindow(canvas, webglContext) {
  const fit = fitScreen({
    width: innerWidth,
    height: innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
    insets: document.fullscreenElement ? undefined : readSafeAreaInsets(),
  });
  canvas.width = fit.deviceWidth;
  canvas.height = fit.deviceHeight;
  canvas.style.width = `${fit.cssWidth}px`;
  canvas.style.height = `${fit.cssHeight}px`;
  canvas.style.left = `${fit.cssLeft}px`;
  canvas.style.top = `${fit.cssTop}px`;
  // One game pixel in CSS pixels, for page decoration that has to line up with the game's pixels.
  document.documentElement.style.setProperty('--game-pixel', `${fit.cssWidth / SCREEN_WIDTH}px`);
  webglContext.viewport(0, 0, canvas.width, canvas.height);
}

export function createWindow(canvas, vertexShaderSource, fragmentShaderSource) {
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
  const timeUniformLocation = webglContext.getUniformLocation(program, 'u_time');

  addEventListener('resize', () => resizeToFitWindow(canvas, webglContext));
  // Entering or leaving fullscreen usually fires 'resize' too, but this covers browsers where it doesn't.
  document.addEventListener('fullscreenchange', () => resizeToFitWindow(canvas, webglContext));
  resizeToFitWindow(canvas, webglContext);

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
    render({ backgroundCanvas, gameCanvas, uiCanvas, shakeOffset, seaRippleBytes, waterLineY, timeSeconds }) {
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
      webglContext.uniform1f(waterLineUniformLocation, waterLineY);
      webglContext.uniform1f(timeUniformLocation, timeSeconds);
      webglContext.drawArrays(webglContext.TRIANGLE_STRIP, 0, 4);
    },
  };
}
