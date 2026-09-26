import { TICK_RATE } from './engine/config.js';
import { createGameLoop } from './engine/game-loop.js';
import { createKeyboardInput } from './engine/input.js';
import { Renderer } from './engine/renderer.js';
import { SceneManager } from './engine/scene-manager.js';
import { createWindow } from './engine/window.js';
import { VersusScene } from './scenes/versus-scene.js';

async function loadText(path) {
  const response = await fetch(path);
  return response.text();
}

async function main() {
  const isDevMode = new URLSearchParams(location.search).has('dev');

  const [keyMappings, vertexShaderSource, fragmentShaderSource] = await Promise.all([
    fetch('data/config/key-mappings.json').then((response) => response.json()),
    loadText('data/shaders/composite.vert'),
    loadText('data/shaders/composite.frag'),
  ]);

  const canvas = document.getElementById('screen');
  const gameWindow = createWindow(canvas, vertexShaderSource, fragmentShaderSource);
  const renderer = new Renderer();
  const input = createKeyboardInput(keyMappings);
  const sceneManager = new SceneManager();
  sceneManager.setScene(new VersusScene({ startInFightPhase: isDevMode }));

  function renderFrame(timestamp) {
    sceneManager.render(renderer);
    gameWindow.render({
      backgroundCanvas: renderer.backgroundChanged ? renderer.backgroundCanvas : null,
      gameCanvas: renderer.gameCanvas,
      uiCanvas: renderer.uiCanvas,
      waterLineY: sceneManager.currentScene.waterLineY,
      timeSeconds: timestamp / 1000,
    });
    renderer.backgroundChanged = false;
  }

  const gameLoop = createGameLoop({
    tickRate: TICK_RATE,
    update() {
      sceneManager.update(input.sample());
    },
    render: renderFrame,
  });
  gameLoop.start();

  // Exposed for devtools and automated checks.
  window.claudeJump = { sceneManager };

  if (isDevMode) {
    // Lets a tester or script drive ticks directly, which keeps working while the tab is hidden.
    window.claudeJump.step = function step(tickCount, inputRecords) {
      for (let tick = 0; tick < tickCount; tick++) {
        const inputByPlayerId = Array.isArray(inputRecords) ? inputRecords[tick] : inputRecords;
        sceneManager.update(inputByPlayerId ?? {});
      }

      const scene = sceneManager.currentScene;
      return {
        phase: scene.phase,
        wins: { ...scene.wins },
        players: scene.players.map((player) => ({ id: player.id, x: player.x, y: player.y })),
      };
    };

    window.claudeJump.render = function render() {
      renderFrame(performance.now());
    };
  }
}

main();
