import { SCREEN_HEIGHT, SCREEN_WIDTH, TICK_RATE } from './engine/config.js';
import { createGameLoop } from './engine/game-loop.js';
import { createGamepadInput } from './engine/gamepad-input.js';
import { combineInputs, createKeyboardInput } from './engine/input.js';
import { Renderer } from './engine/renderer.js';
import { SceneManager } from './engine/scene-manager.js';
import { loadSpriteFile } from './engine/sprites.js';
import { loadLevel, stoneColorOverrides } from './levels/level-loader.js';
import { createLevelThumbnail } from './levels/level-thumbnail.js';
import { isPortraitOnTouchDevice } from './engine/screen-fit.js';
import { createWindow } from './engine/window.js';
import { PausableMatchScene } from './scenes/pausable-match-scene.js';
import { StyleTestScene } from './scenes/style-test-scene.js';
import { FULLSCREEN_BUTTON, TitleScene } from './scenes/title-scene.js';
import { SurvivalScene } from './scenes/survival-scene.js';
import { VersusScene } from './scenes/versus-scene.js';
import { drawRotatePrompt } from './ui/rotate-prompt.js';

// The order of the level select tiles.
const LEVEL_FILE_NAMES = ['harbor', 'rooftops', 'cave', 'server-farm', 'cooling-towers', 'bridge', 'quarry'];

async function loadText(path) {
  const response = await fetch(path);
  return response.text();
}

async function main() {
  const searchParameters = new URLSearchParams(location.search);
  const isDevMode = searchParameters.has('dev');

  const [
    keyMappings,
    claude,
    muse,
    chatgpt,
    gemini,
    grok,
    deepseek,
    mistral,
    props,
    rotateIcon,
    blocks,
    vertexShaderSource,
    fragmentShaderSource,
  ] = await Promise.all([
    fetch('data/config/key-mappings.json').then((response) => response.json()),
    loadSpriteFile('data/sprites/claude.json'),
    loadSpriteFile('data/sprites/muse.json'),
    loadSpriteFile('data/sprites/chatgpt.json'),
    loadSpriteFile('data/sprites/gemini.json'),
    loadSpriteFile('data/sprites/grok.json'),
    loadSpriteFile('data/sprites/deepseek.json'),
    loadSpriteFile('data/sprites/mistral.json'),
    loadSpriteFile('data/sprites/props.json'),
    loadSpriteFile('data/sprites/rotate-icon.json'),
    loadSpriteFile('data/sprites/blocks.json'),
    loadText('data/shaders/composite.vert'),
    loadText('data/shaders/composite.frag'),
  ]);

  const levels = await Promise.all(LEVEL_FILE_NAMES.map((fileName) => loadLevel(`data/levels/${fileName}.json`)));
  for (const level of levels) level.thumbnail = createLevelThumbnail(level);

  const canvas = document.getElementById('screen');
  const gameWindow = createWindow(canvas, vertexShaderSource, fragmentShaderSource);
  if (!gameWindow) {
    canvas.style.display = 'none';
    document.getElementById('webgl-message').style.display = 'block';
    return;
  }
  const renderer = new Renderer();
  const keyboardInput = createKeyboardInput(keyMappings);
  const gamepadInput = createGamepadInput(keyMappings.map((mapping) => mapping.id));
  const sceneManager = new SceneManager();
  const sprites = { claude, muse, chatgpt, gemini, grok, deepseek, mistral, props, blocks };
  // Survival builds its platforms from the Harbor stone, the first level file.
  sprites.stoneBlocks = levels[0].tileSprites;
  const platformStoneColors = {
    ice: { light: '#2ce8f5', mid: '#0099db', dark: '#124e89' },
    fire: { light: '#feae34', mid: '#f77622', dark: '#be4a2f' },
    'fire-flicker': { light: '#fee761', mid: '#feae34', dark: '#f77622' },
    crumbling: { light: '#a09088', mid: '#585050', dark: '#3e2731' },
  };
  sprites.stoneBlocksByKind = { stone: sprites.stoneBlocks };
  for (const [kind, colors] of Object.entries(platformStoneColors)) {
    sprites.stoneBlocksByKind[kind] = await loadSpriteFile('data/sprites/blocks.json', stoneColorOverrides(colors));
  }
  if (isDevMode && searchParameters.get('scene') === 'style') {
    sceneManager.setScene(new StyleTestScene({ sprites }));
  } else if (isDevMode && searchParameters.get('scene') === 'survival') {
    sceneManager.setScene(new SurvivalScene({ sprites, seed: 0 }));
  } else if (isDevMode) {
    // ?dev&level=cave starts on that level file. Harbor is the default.
    const levelIndex = Math.max(0, LEVEL_FILE_NAMES.indexOf(searchParameters.get('level')));
    sceneManager.setScene(
      new PausableMatchScene({
        sceneManager,
        matchScene: new VersusScene({
          level: levels[levelIndex],
          startInFightPhase: true,
          seed: 0,
          sprites,
          levels,
        }),
      }),
    );
  } else {
    sceneManager.setScene(new TitleScene({ sceneManager, levels, sprites, seed: Date.now() }));
  }

  // Dev mode never shows the rotate prompt, so scripted checks work in any window shape.
  const coarsePointerQuery = matchMedia('(pointer: coarse)');
  function showingRotatePrompt() {
    return (
      !isDevMode &&
      isPortraitOnTouchDevice({
        width: innerWidth,
        height: innerHeight,
        hasCoarsePointer: coarsePointerQuery.matches,
      })
    );
  }

  function renderFrame(timestamp) {
    renderer.shakeOffset = { x: 0, y: 0 };
    renderer.seaRippleBytes = null;
    sceneManager.render(renderer);
    if (showingRotatePrompt()) drawRotatePrompt(renderer.uiContext, rotateIcon.icon);
    gameWindow.render({
      backgroundCanvas: renderer.backgroundChanged ? renderer.backgroundCanvas : null,
      gameCanvas: renderer.gameCanvas,
      uiCanvas: renderer.uiCanvas,
      shakeOffset: renderer.shakeOffset,
      seaRippleBytes: renderer.seaRippleBytes,
      waterLineY: sceneManager.currentScene.waterLineY,
      timeSeconds: timestamp / 1000,
    });
    renderer.backgroundChanged = false;
  }

  const gameLoop = createGameLoop({
    tickRate: TICK_RATE,
    update() {
      if (showingRotatePrompt()) {
        sceneManager.currentScene?.pauseForFocusLoss?.();
        return;
      }
      sceneManager.update(combineInputs(keyboardInput.sample(), gamepadInput.sample()));
    },
    render: renderFrame,
  });
  gameLoop.start();

  if (!isDevMode) {
    // Dev mode steps ticks by hand even in a hidden tab, so it must never auto-pause.
    const pauseForFocusLoss = () => sceneManager.currentScene?.pauseForFocusLoss?.();
    addEventListener('blur', pauseForFocusLoss);
    addEventListener('visibilitychange', () => {
      if (document.hidden) pauseForFocusLoss();
    });
  }

  function toggleFullscreen() {
    // Can throw or reject if the browser denies the request (no user gesture, disabled by
    // policy, etc.); there is nothing more to do about it than leave the game windowed.
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else canvas.requestFullscreen().catch(() => {});
    } catch {
      // ignored
    }
  }

  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  addEventListener('keydown', (event) => {
    if (event.code === 'KeyF') toggleFullscreen();
  });

  // The title screen draws its own fullscreen button; this just hit-tests a click against it.
  canvas.addEventListener('click', (event) => {
    if (!(sceneManager.currentScene instanceof TitleScene)) return;
    const bounds = canvas.getBoundingClientRect();
    const clickX = ((event.clientX - bounds.left) / bounds.width) * SCREEN_WIDTH;
    const clickY = ((event.clientY - bounds.top) / bounds.height) * SCREEN_HEIGHT;
    const button = FULLSCREEN_BUTTON;
    const withinButton =
      clickX >= button.x &&
      clickX <= button.x + button.width &&
      clickY >= button.y &&
      clickY <= button.y + button.height;
    if (withinButton) toggleFullscreen();
  });

  // Exposed for devtools and automated checks.
  window.claudeJump = { sceneManager };

  if (isDevMode) {
    // Lets a tester or script drive ticks directly, which keeps working while the tab is hidden.
    window.claudeJump.step = function step(tickCount, inputRecords) {
      for (let tick = 0; tick < tickCount; tick++) {
        const inputByPlayerId = Array.isArray(inputRecords) ? inputRecords[tick] : inputRecords;
        sceneManager.update(inputByPlayerId ?? {});
      }

      const currentScene = sceneManager.currentScene;
      const scene = currentScene.matchScene ?? currentScene;
      return {
        phase: scene.phase,
        wins: { ...scene.wins },
        cameraTopY: scene.cameraTopY,
        players: scene.players.map((player) => ({ id: player.id, x: player.x, y: player.y })),
      };
    };

    window.claudeJump.render = function render() {
      renderFrame(performance.now());
    };
  }
}

main();
