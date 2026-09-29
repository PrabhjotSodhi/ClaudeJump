import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PausableMatchScene } from '../src/scenes/pausable-match-scene.js';
import { TitleScene } from '../src/scenes/title-scene.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { harborLevel } from './fixtures/harbor-level.mjs';

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
  assert.equal(scene.selectedIndex, 1, 'up from the first option wraps to the last');

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
