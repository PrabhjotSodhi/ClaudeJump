precision mediump float;

uniform sampler2D u_backgroundLayer;
uniform sampler2D u_gameLayer;
uniform sampler2D u_uiLayer;
uniform sampler2D u_glowLayer;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_waterLine;
uniform vec2 u_shakeOffset;
uniform float u_zoomFactor;
uniform vec2 u_zoomOrigin;
uniform sampler2D u_seaHeights;

varying vec2 v_uv;

const float SEA_COLUMN_COUNT = 80.0;

const float GLOW_STRENGTH = 0.6;

const vec3 WATER_TOP_COLOR = vec3(0.16, 0.36, 0.82);
const vec3 WATER_DEEP_COLOR = vec3(0.06, 0.16, 0.47);
const vec3 CREST_COLOR = vec3(0.72, 0.9, 1.0);

vec4 samplePixel(sampler2D layer, vec2 pixelPosition) {
  return texture2D(layer, (pixelPosition + 0.5) / u_resolution);
}

// A fixed 13 tap blur of the glow layer, in game pixels. Only the glow layer is blurred, never the art.
vec3 glowAt(vec2 pixelPosition) {
  vec2 center = (pixelPosition + 0.5) / u_resolution;
  vec2 pixel = 1.0 / u_resolution;
  vec3 sum = texture2D(u_glowLayer, center).rgb * 0.2;
  sum += (texture2D(u_glowLayer, center + vec2(pixel.x, 0.0)).rgb + texture2D(u_glowLayer, center - vec2(pixel.x, 0.0)).rgb +
          texture2D(u_glowLayer, center + vec2(0.0, pixel.y)).rgb + texture2D(u_glowLayer, center - vec2(0.0, pixel.y)).rgb) * 0.1;
  sum += (texture2D(u_glowLayer, center + pixel * vec2(1.5, 1.5)).rgb + texture2D(u_glowLayer, center + pixel * vec2(-1.5, 1.5)).rgb +
          texture2D(u_glowLayer, center + pixel * vec2(1.5, -1.5)).rgb + texture2D(u_glowLayer, center + pixel * vec2(-1.5, -1.5)).rgb) * 0.06;
  sum += (texture2D(u_glowLayer, center + vec2(pixel.x * 3.0, 0.0)).rgb + texture2D(u_glowLayer, center - vec2(pixel.x * 3.0, 0.0)).rgb +
          texture2D(u_glowLayer, center + vec2(0.0, pixel.y * 3.0)).rgb + texture2D(u_glowLayer, center - vec2(0.0, pixel.y * 3.0)).rgb) * 0.04;
  return sum;
}

vec3 sceneColor(vec2 pixelPosition) {
  vec4 gameColor = samplePixel(u_gameLayer, pixelPosition);
  return mix(samplePixel(u_backgroundLayer, pixelPosition).rgb, gameColor.rgb, gameColor.a);
}

void main() {
  vec2 screenPixel = floor(v_uv * u_resolution);
  vec2 pixelPosition = floor(screenPixel / u_zoomFactor) + u_zoomOrigin - u_shakeOffset;
  float seaColumn = clamp(floor(pixelPosition.x / u_resolution.x * SEA_COLUMN_COUNT), 0.0, SEA_COLUMN_COUNT - 1.0);
  float rippleHeight = texture2D(u_seaHeights, vec2((seaColumn + 0.5) / SEA_COLUMN_COUNT, 0.5)).r * 255.0 - 128.0;
  float surfaceY = u_waterLine + rippleHeight + floor(sin(pixelPosition.x * 0.15 + u_time * 4.8) * 3.0 + 0.5);
  float depth = pixelPosition.y - surfaceY;

  vec3 color;
  if (depth < 0.0) {
    color = sceneColor(pixelPosition);
  } else if (depth < 2.0) {
    color = CREST_COLOR;
  } else {
    float ripple = floor(sin(pixelPosition.y * 0.45 + u_time * 4.0) * 3.0 + 0.5);
    vec3 reflection = sceneColor(clamp(vec2(pixelPosition.x + ripple, surfaceY - depth), vec2(0.0), u_resolution - 1.0));
    color = mix(WATER_TOP_COLOR, WATER_DEEP_COLOR, clamp(depth / 28.0, 0.0, 1.0));
    color = mix(color, reflection, 0.4 * (1.0 - clamp(depth / 32.0, 0.0, 1.0)));
    vec4 underwaterGame = samplePixel(u_gameLayer, pixelPosition);
    color = mix(color, underwaterGame.rgb * WATER_TOP_COLOR * 1.4, underwaterGame.a * 0.5);
  }

  color += glowAt(pixelPosition) * GLOW_STRENGTH;

  vec4 uiColor = samplePixel(u_uiLayer, screenPixel);
  color = mix(color, uiColor.rgb, uiColor.a);

  vec2 vignetteOffset = v_uv - 0.5;
  color *= 1.0 - dot(vignetteOffset, vignetteOffset) * 0.35;
  gl_FragColor = vec4(color, 1.0);
}
