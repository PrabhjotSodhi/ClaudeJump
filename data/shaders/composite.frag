precision mediump float;

uniform sampler2D u_backgroundLayer;
uniform sampler2D u_gameLayer;
uniform sampler2D u_uiLayer;
uniform sampler2D u_lightLayer;
uniform sampler2D u_paletteLookup;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_waterLine;
uniform float u_lightingEnabled;
uniform float u_fogStrength;
uniform vec2 u_fogScroll;

varying vec2 v_uv;

const vec3 WATER_TOP_COLOR = vec3(0.16, 0.36, 0.82);
const vec3 WATER_DEEP_COLOR = vec3(0.06, 0.16, 0.47);
const vec3 CREST_COLOR = vec3(0.72, 0.9, 1.0);
const float NIGHT_WATER_BRIGHTNESS = 0.55;
// Must match the palette size and the fog period in window.js.
const int PALETTE_SIZE = 32;
const float FOG_PERIOD = 512.0;
// Unlit pixels sit this many steps down their ramp. Each light level lifts a pixel one step.
const float UNLIT_RAMP_STEPS = 2.0;

vec4 samplePixel(sampler2D layer, vec2 pixelPosition) {
  return texture2D(layer, (pixelPosition + 0.5) / u_resolution);
}

vec3 sceneColor(vec2 pixelPosition) {
  vec4 gameColor = samplePixel(u_gameLayer, pixelPosition);
  return mix(samplePixel(u_backgroundLayer, pixelPosition).rgb, gameColor.rgb, gameColor.a);
}

// Palette lookup texture: one column per palette color, row n holds that color stepped down its ramp n times.
// Row 0 is the palette itself, so matching a pixel against row 0 finds its column. Colors outside the palette pass through.
vec3 stepDownRamp(vec3 color, float steps) {
  for (int index = 0; index < PALETTE_SIZE; index++) {
    float column = (float(index) + 0.5) / float(PALETTE_SIZE);
    vec3 paletteColor = texture2D(u_paletteLookup, vec2(column, 0.125)).rgb;
    if (all(lessThan(abs(paletteColor - color), vec3(0.003)))) {
      return texture2D(u_paletteLookup, vec2(column, (steps + 0.5) / 4.0)).rgb;
    }
  }
  return color;
}

float cellHash(vec2 cell, float cellCount) {
  vec3 p3 = fract(vec3(mod(cell, cellCount).xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 position, float cellSize) {
  float cellCount = FOG_PERIOD / cellSize;
  vec2 scaled = position / cellSize;
  vec2 cell = floor(scaled);
  vec2 blend = smoothstep(0.0, 1.0, fract(scaled));
  float top = mix(cellHash(cell, cellCount), cellHash(cell + vec2(1.0, 0.0), cellCount), blend.x);
  float bottom = mix(cellHash(cell + vec2(0.0, 1.0), cellCount), cellHash(cell + vec2(1.0, 1.0), cellCount), blend.x);
  return mix(top, bottom, blend.y);
}

// Scrolling noise plus a corner vignette, in whole pixels. Values of 1 or more darken a pixel by one more ramp step.
float fogDarkness(vec2 pixelPosition) {
  vec2 fogPosition = pixelPosition + u_fogScroll;
  float noise = 0.6 * valueNoise(fogPosition, 128.0) + 0.4 * valueNoise(fogPosition, 32.0);
  float fog = clamp((noise - 0.3) * 2.0, 0.0, 1.0) * u_fogStrength;
  vec2 fromCenter = (pixelPosition + 0.5) / u_resolution - 0.5;
  return fog + dot(fromCenter, fromCenter) * 1.2;
}

vec3 litSceneColor(vec2 pixelPosition) {
  vec3 color = sceneColor(pixelPosition);
  if (u_lightingEnabled < 0.5) return color;
  float lightLevel = floor(samplePixel(u_lightLayer, pixelPosition).r * 3.0 + 0.5);
  // Open air and the distant background catch one step of light at most, so a light glows instead of cutting a disc.
  if (samplePixel(u_gameLayer, pixelPosition).a < 0.5) lightLevel = min(lightLevel, 1.0);
  float extraSteps = floor(max(fogDarkness(pixelPosition) - lightLevel * 0.25, 0.0));
  return stepDownRamp(color, clamp(UNLIT_RAMP_STEPS - lightLevel + extraSteps, 0.0, 3.0));
}

void main() {
  vec2 pixelPosition = floor(v_uv * u_resolution);
  float surfaceY = u_waterLine + floor(sin(pixelPosition.x * 0.15 + u_time * 4.8) * 3.0 + 0.5);
  float depth = pixelPosition.y - surfaceY;
  float waterBrightness = mix(1.0, NIGHT_WATER_BRIGHTNESS, u_lightingEnabled);

  vec3 color;
  if (depth < 0.0) {
    color = litSceneColor(pixelPosition);
  } else if (depth < 2.0) {
    color = CREST_COLOR * waterBrightness;
  } else {
    float ripple = floor(sin(pixelPosition.y * 0.45 + u_time * 4.0) * 3.0 + 0.5);
    vec3 reflection = litSceneColor(clamp(vec2(pixelPosition.x + ripple, surfaceY - depth), vec2(0.0), u_resolution - 1.0));
    color = mix(WATER_TOP_COLOR, WATER_DEEP_COLOR, clamp(depth / 28.0, 0.0, 1.0)) * waterBrightness;
    color = mix(color, reflection, 0.4 * (1.0 - clamp(depth / 32.0, 0.0, 1.0)));
    vec4 underwaterGame = samplePixel(u_gameLayer, pixelPosition);
    color = mix(color, underwaterGame.rgb * WATER_TOP_COLOR * 1.4, underwaterGame.a * 0.5);
  }

  vec4 uiColor = samplePixel(u_uiLayer, pixelPosition);
  color = mix(color, uiColor.rgb, uiColor.a);

  if (u_lightingEnabled < 0.5) {
    vec2 vignetteOffset = v_uv - 0.5;
    color *= 1.0 - dot(vignetteOffset, vignetteOffset) * 0.35;
  }
  gl_FragColor = vec4(color, 1.0);
}
