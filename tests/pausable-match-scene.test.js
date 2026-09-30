import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KNOCKOUT_SLOWMO_TICKS } from '../src/engine/config.js';
import { SoundPlayer } from '../src/engine/sound-player.js';
import { PausableMatchScene, RESULTS_MENU_OPTIONS } from '../src/scenes/pausable-match-scene.js';
import { PlayerSelectScene, START_COUNTDOWN_TICKS } from '../src/scenes/player-select-scene.js';
import { TitleScene } from '../src/scenes/title-scene.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { harborLevel } from './fixtures/harbor-level.mjs';
import { ROUND_COUNTDOWN_TICKS as READY_TICKS } from '../src/engine/config.js';

function noInput() {
  return {
    left: false,
    right: false,
    jump: false,
    up: false,
    down: false,
    action: false,
    confirm: false,
    pause: false,
  };
}

function neutralInputs() {
  return { red: noInput(), blue: noInput() };
}

function inputsWith(playerId, overrides) {
  const inputs = neutralInputs();
  inputs[playerId] = { ...noInput(), ...overrides };
  return inputs;
}

function pausedScene(overrides = {}) {
  const scenes = [];
  const sceneManager = { setScene: (nextScene) => scenes.push(nextScene) };
  const matchScene = new VersusScene({ level: harborLevel, startInFightPhase: true, seed: 0 });
  const scene = new PausableMatchScene({ sceneManager, matchScene, ...overrides });
  return { scene, matchScene, sceneManager, scenes };
}

function findPlayer(matchScene, playerId) {
  return matchScene.players.find((player) => player.id === playerId);
}

test('a match starts with the pause menu hidden', () => {
  const { scene } = pausedScene();
  scene.update(neutralInputs());

  assert.equal(scene.paused, false);
  assert.equal(scene.pauseMotion.isClosed, true);
});

test('a fresh pause press stops the match from ticking', () => {
  const { scene, matchScene } = pausedScene();

  scene.update(inputsWith('red', { pause: true }));
  const tickCountAfterPausing = matchScene.tickCount;
  scene.update(neutralInputs());
  scene.update(neutralInputs());

  assert.equal(scene.paused, true);
  assert.equal(matchScene.tickCount, tickCountAfterPausing, 'the match must not tick while paused');
});

test('a second fresh pause press resumes ticking', () => {
  const { scene, matchScene } = pausedScene();

  scene.update(inputsWith('red', { pause: true }));
  const tickCountWhilePaused = matchScene.tickCount;
  scene.update(neutralInputs()); // release the key before pressing it again
  scene.update(inputsWith('red', { pause: true }));
  scene.update(neutralInputs());

  assert.equal(scene.paused, false);
  assert.ok(matchScene.tickCount > tickCountWhilePaused, 'the match must tick again once resumed');
});

test('holding pause does not toggle every tick', () => {
  const { scene } = pausedScene();
  const heldPause = inputsWith('red', { pause: true });

  scene.update(heldPause);
  scene.update(heldPause);
  scene.update(heldPause);

  assert.equal(scene.paused, true, 'a held key must only toggle once');
});

test('either player pausing stops the match', () => {
  const { scene, matchScene } = pausedScene();

  scene.update(inputsWith('blue', { pause: true }));
  const tickCountAfterPausing = matchScene.tickCount;
  scene.update(neutralInputs());

  assert.equal(scene.paused, true);
  assert.equal(matchScene.tickCount, tickCountAfterPausing);
});

test('Resume closes the menu without returning to the title', () => {
  const { scene, sceneManager, scenes } = pausedScene();
  sceneManager.setScene = (nextScene) => scenes.push(nextScene);

  scene.update(inputsWith('red', { pause: true }));
  scene.update(inputsWith('red', { confirm: true })); // Resume is selected by default

  assert.equal(scene.paused, false);
  assert.equal(scenes.length, 0);
});

test('Return to title switches the scene to a fresh TitleScene', () => {
  const { scene, scenes } = pausedScene();

  scene.update(inputsWith('red', { pause: true }));
  scene.update(inputsWith('red', { down: true })); // moves selection to Return to title
  scene.update(inputsWith('red', { confirm: true })); // confirms it

  assert.equal(scenes.length, 1);
  assert.equal(scenes[0].constructor.name, 'TitleScene');
});

test("the title seed is drawn from the match's seeded random, not the clock", () => {
  // A second match built with the same seed draws the same first random value, so the title
  // seed this test expects is not tied to Date.now() or any other wall-clock source.
  const expectedSeed = Math.floor(new VersusScene({ level: harborLevel, seed: 0 }).random.next() * 0xffffffff);
  const { scene, scenes } = pausedScene();

  scene.update(inputsWith('red', { pause: true }));
  scene.update(inputsWith('red', { down: true }));
  scene.update(inputsWith('red', { confirm: true }));

  assert.equal(scenes[0].seed, expectedSeed);
});

test('a confirm held when the menu opens does not immediately confirm Resume', () => {
  const { scene, scenes } = pausedScene();
  const heldJump = inputsWith('red', { pause: true, confirm: true });

  scene.update(heldJump);
  // Pause consumed the tick; jump is still held on the very next tick with the menu open.
  scene.update(inputsWith('red', { confirm: true }));

  assert.equal(scene.paused, true, 'the held confirm must not confirm the menu the instant it opens');
  assert.equal(scenes.length, 0);
});

test('a confirm held to confirm Return to title does not immediately re-confirm the new title screen', () => {
  const { scene, scenes } = pausedScene();

  scene.update(inputsWith('red', { pause: true }));
  scene.update(inputsWith('red', { down: true }));
  const heldJump = inputsWith('red', { confirm: true });
  scene.update(heldJump); // confirms Return to title, confirm still held

  const titleScene = scenes[0];
  titleScene.update(heldJump); // still held on the title's first tick

  assert.equal(titleScene.selectedIndex, 0, 'the held jump must not confirm the title menu again');
});

test('a down held when the menu opens does not immediately move the selection', () => {
  const { scene } = pausedScene();

  scene.update(inputsWith('red', { pause: true, down: true }));
  scene.update(inputsWith('red', { down: true })); // still held, menu now open

  assert.equal(scene.selectedIndex, 0, 'the held down must not move the selection the instant it opens');
});

test('losing focus pauses a running match', () => {
  const { scene, matchScene } = pausedScene();

  scene.pauseForFocusLoss();
  const tickCountAfterPausing = matchScene.tickCount;
  scene.update(neutralInputs());

  assert.equal(scene.paused, true);
  assert.equal(matchScene.tickCount, tickCountAfterPausing);
});

test('confirming Resume with jump held does not make the player jump', () => {
  const { scene, matchScene } = pausedScene();
  matchScene.update(neutralInputs()); // let the grounded player settle before pausing
  const groundedY = findPlayer(matchScene, 'red').y;

  scene.update(inputsWith('red', { pause: true }));
  const heldJump = inputsWith('red', { jump: true });
  scene.update(heldJump); // confirms Resume while jump is still held

  scene.update(heldJump);
  scene.update(heldJump);
  scene.update(heldJump);

  assert.equal(
    findPlayer(matchScene, 'red').y,
    groundedY,
    'a jump held through Resume must not launch the player once the match ticks again',
  );
});

test('losing focus while already paused does not reset the selection', () => {
  const { scene } = pausedScene();

  scene.update(inputsWith('red', { pause: true }));
  scene.update(inputsWith('red', { down: true }));
  assert.equal(scene.selectedIndex, 1);

  scene.pauseForFocusLoss();

  assert.equal(scene.selectedIndex, 1);
});

test('up moves the pause selection up with wrapping, and down moves it down', () => {
  const { scene } = pausedScene();
  scene.update(inputsWith('red', { pause: true }));

  scene.update(inputsWith('red', { up: true }));
  assert.equal(scene.selectedIndex, 3, 'up from the first option wraps to the last');

  scene.update(neutralInputs());
  scene.update(inputsWith('blue', { down: true }));
  assert.equal(scene.selectedIndex, 0, 'down from the last option wraps to the first');
});

test('jump does not select in the pause menu', () => {
  const { scene, scenes } = pausedScene();
  scene.update(inputsWith('red', { pause: true }));

  scene.update(inputsWith('red', { jump: true }));

  assert.equal(scene.paused, true);
  assert.equal(scenes.length, 0);
});

test('resuming with up, action and confirm held keeps them out of the match until released', () => {
  const { scene, matchScene } = pausedScene();
  scene.update(inputsWith('red', { pause: true }));
  scene.update(neutralInputs());
  const heldControls = inputsWith('red', { pause: true, confirm: true, action: true, up: true });
  scene.update(heldControls); // the pause press resumes with all three held

  const forwarded = [];
  matchScene.update = (inputByPlayerId) => forwarded.push(inputByPlayerId.red);
  scene.update(heldControls);

  assert.equal(forwarded[0].action, false);
  assert.equal(forwarded[0].confirm, false);
  assert.equal(forwarded[0].up, false);
});

test('Return to title, then Versus, opens a player select that can run a tick', () => {
  let currentScene;
  const sceneManager = { setScene: (nextScene) => (currentScene = nextScene) };
  const readyInputs = () => ({ red: { ...noInput(), jump: true }, blue: { ...noInput(), jump: true } });
  const playerSelectScene = new PlayerSelectScene({ sceneManager, levels: [harborLevel], seed: 0 });
  playerSelectScene.update(neutralInputs());
  for (let press = 0; press < 2; press++) {
    playerSelectScene.update(readyInputs());
    playerSelectScene.update(neutralInputs());
  }
  for (let tick = 0; tick < START_COUNTDOWN_TICKS; tick++) playerSelectScene.update(neutralInputs());
  const levelSelectScene = currentScene;
  levelSelectScene.update(neutralInputs());
  levelSelectScene.update(readyInputs());
  for (let tick = 0; tick < 120 && currentScene === levelSelectScene; tick++) levelSelectScene.update(neutralInputs());
  assert.equal(currentScene.constructor.name, 'PausableMatchScene');

  currentScene.update(inputsWith('red', { pause: true }));
  currentScene.update(inputsWith('red', { down: true }));
  currentScene.update(inputsWith('red', { confirm: true }));
  const titleScene = currentScene;
  assert.equal(titleScene.constructor.name, 'TitleScene');

  titleScene.update(neutralInputs());
  titleScene.update(inputsWith('red', { confirm: true }));

  assert.equal(currentScene.constructor.name, 'PlayerSelectScene');
  assert.doesNotThrow(() => currentScene.update(neutralInputs()));
});

const POINT_PAUSE_TICKS = 90;
const RESULTS_DELAY_TICKS = 60;

function sceneJustBeforeResults() {
  const setup = pausedScene();
  const { scene, matchScene } = setup;
  matchScene.levels = [harborLevel];
  matchScene.characterByPlayerId = { red: 'muse', blue: 'claude' };
  for (let win = 1; win <= 5; win++) {
    for (let tick = 0; tick < READY_TICKS; tick++) scene.update(neutralInputs());
    findPlayer(matchScene, 'blue').y = 600;
    scene.update(neutralInputs());
    for (let tick = 0; tick < KNOCKOUT_SLOWMO_TICKS; tick++) scene.update(neutralInputs());
    if (win < 5) for (let tick = 0; tick < POINT_PAUSE_TICKS; tick++) scene.update(neutralInputs());
  }
  for (let tick = 0; tick < RESULTS_DELAY_TICKS - 1; tick++) scene.update(neutralInputs());
  return setup;
}

function sceneShowingResults() {
  const setup = sceneJustBeforeResults();
  setup.scene.update(neutralInputs());
  setup.scene.update(neutralInputs()); // the first tick showing only records what is held
  assert.equal(setup.matchScene.phase, 'match');
  return setup;
}

function choose(scene, optionIndex, confirmInput = { confirm: true }) {
  for (let step = 0; step < optionIndex; step++) {
    scene.update(inputsWith('red', { down: true }));
    scene.update(neutralInputs());
  }
  scene.update(inputsWith('red', confirmInput));
}

test('Rematch keeps the level and characters and starts a fresh match', () => {
  const { scene, matchScene, scenes } = sceneShowingResults();
  const level = matchScene.level;
  const characterByPlayerId = matchScene.characterByPlayerId;

  choose(scene, 0);

  assert.equal(scenes.length, 0, 'a rematch stays in the same scene');
  assert.equal(matchScene.phase, 'ready');
  assert.deepEqual(matchScene.wins, { red: 0, blue: 0 });
  assert.equal(matchScene.level, level);
  assert.equal(matchScene.characterByPlayerId, characterByPlayerId);
});

test('Change level opens level select with the same characters', () => {
  const { scene, matchScene, scenes } = sceneShowingResults();

  choose(scene, 1);

  assert.equal(scenes.length, 1);
  assert.equal(scenes[0].constructor.name, 'LevelSelectScene');
  assert.equal(scenes[0].characterByPlayerId, matchScene.characterByPlayerId);
  assert.equal(scenes[0].levels, matchScene.levels);
});

test('Change characters opens player select', () => {
  const { scene, scenes } = sceneShowingResults();

  choose(scene, 2);

  assert.equal(scenes.length, 1);
  assert.equal(scenes[0].constructor.name, 'PlayerSelectScene');
});

test('Rematch is selected by default and awards pop in with a sound event', () => {
  const { scene } = sceneShowingResults();
  const shown = [];
  scene.events.on('award-shown', ({ awardId }) => shown.push(awardId));
  scene.update(neutralInputs());
  assert.equal(scene.resultsSelectedIndex, 0);
  for (let tick = 0; tick < 300; tick++) scene.update(neutralInputs());

  assert.equal(RESULTS_MENU_OPTIONS[scene.resultsSelectedIndex].id, 'rematch');
  assert.deepEqual(shown, ['splashes']);
});

test('jump confirms the selected results option, and up wraps to the last one', () => {
  const { scene, scenes } = sceneShowingResults();

  scene.update(inputsWith('blue', { up: true }));
  scene.update(neutralInputs());
  scene.update(inputsWith('blue', { jump: true }));

  assert.equal(scenes[0].constructor.name, 'PlayerSelectScene');
});

test('a jump held from the fight does not choose an option when the results appear', () => {
  const { scene, scenes } = sceneJustBeforeResults();
  const heldJump = inputsWith('red', { jump: true });

  scene.update(heldJump);
  scene.update(heldJump);
  scene.update(heldJump);

  assert.equal(scenes.length, 0);
  assert.equal(scene.matchScene.phase, 'match');
});

test('pause does not open while the results menu is showing', () => {
  const { scene } = sceneShowingResults();

  scene.update(inputsWith('red', { pause: true }));

  assert.equal(scene.paused, false);
});

test('confirming the Sound row flips the sound setting and stays paused', () => {
  const soundPlayer = new SoundPlayer({ soundDefinitions: {}, eventSounds: {} });
  const { scene, sceneManager } = pausedScene();
  sceneManager.soundPlayer = soundPlayer;
  scene.update(inputsWith('red', { pause: true }));
  scene.update(inputsWith('red', { up: true }));
  scene.update(neutralInputs());
  scene.update(inputsWith('red', { up: true }));
  scene.update(neutralInputs());

  scene.update(inputsWith('red', { confirm: true }));

  assert.equal(soundPlayer.soundEnabled, false);
  assert.equal(scene.paused, true);
  assert.equal(scene.pauseMenuOptions[2].label, 'Sound: Off');
});

test('the pause menu offers fullscreen only where the browser supports it', () => {
  const { scene, sceneManager } = pausedScene();
  assert.equal(scene.pauseMenuOptions.length, 4);

  sceneManager.fullscreen = { supported: false, active: false, toggle() {} };
  assert.equal(scene.pauseMenuOptions.length, 4);

  sceneManager.fullscreen = { supported: true, active: false, toggle() {} };
  assert.equal(scene.pauseMenuOptions[4].label, 'Fullscreen: Off');
});

test('confirming the Fullscreen row toggles fullscreen and stays paused', () => {
  const { scene, sceneManager } = pausedScene();
  let toggleCount = 0;
  sceneManager.fullscreen = { supported: true, active: false, toggle: () => toggleCount++ };
  scene.update(inputsWith('red', { pause: true }));
  scene.update(inputsWith('red', { up: true }));
  scene.update(neutralInputs());

  scene.update(inputsWith('red', { confirm: true }));

  assert.equal(toggleCount, 1);
  assert.equal(scene.paused, true);
});
