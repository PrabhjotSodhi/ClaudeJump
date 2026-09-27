precision mediump float;

uniform sampler2D u_backgroundLayer;
uniform sampler2D u_gameLayer;
uniform sampler2D u_uiLayer;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_waterLine;

varying vec2 v_uv;

const vec3 WATER_TOP_COLOR = vec3(0.16, 0.36, 0.82);
const vec3 WATER_DEEP_COLOR = vec3(0.06, 0.16, 0.47);
const vec3 CREST_COLOR = vec3(0.72, 0.9, 1.0);

vec4 samplePixel(sampler2D layer, vec2 pixelPosition) {
  return texture2D(layer, (pixelPosition + 0.5) / u_resolution);
}

vec3 sceneColor(vec2 pixelPosition) {
  vec4 gameColor = samplePixel(u_gameLayer, pixelPosition);
  return mix(samplePixel(u_backgroundLayer, pixelPosition).rgb, gameColor.rgb, gameColor.a);
}

void main() {
  vec2 pixelPosition = floor(v_uv * u_resolution);
  float surfaceY = u_waterLine + floor(sin(pixelPosition.x * 0.15 + u_time * 4.8) * 3.0 + 0.5);
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

  vec4 uiColor = samplePixel(u_uiLayer, pixelPosition);
  color = mix(color, uiColor.rgb, uiColor.a);

  vec2 vignetteOffset = v_uv - 0.5;
  color *= 1.0 - dot(vignetteOffset, vignetteOffset) * 0.35;
  gl_FragColor = vec4(color, 1.0);
}
