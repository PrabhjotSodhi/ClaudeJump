import { SCREEN_HEIGHT, SCREEN_WIDTH, SEA_COLUMN_COUNT } from './config.js';

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

// Largest whole-number scale that fits the window, in device pixels, so every art pixel stays the same size.
function resizeToFitWindow(canvas, webglContext) {
  const devicePixelRatio = window.devicePixelRatio || 1;
  const scale = Math.max(
    1,
    Math.floor(
      Math.min((innerWidth * devicePixelRatio) / SCREEN_WIDTH, (innerHeight * devicePixelRatio) / SCREEN_HEIGHT),
    ),
  );
  canvas.width = SCREEN_WIDTH * scale;
  canvas.height = SCREEN_HEIGHT * scale;
  canvas.style.width = `${canvas.width / devicePixelRatio}px`;
  canvas.style.height = `${canvas.height / devicePixelRatio}px`;
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
