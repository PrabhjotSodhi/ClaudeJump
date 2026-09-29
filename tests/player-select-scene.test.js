import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlayerSelectScene } from '../src/scenes/player-select-scene.js';
import { harborLevel } from './fixtures/harbor-level.mjs';

function noInput() {
  return { left: false, right: false, jump: false, down: false, action: false };
}

function neutralInputs() {
  return { red: noInput(), blue: noInput() };
}

function inputsWithJump(playerId) {
  const inputs = neutralInputs();
  inputs[playerId] = { ...noInput(), jump: true };
  return inputs;
}

function sceneWithBaseline(overrides = {}) {
  const scenes = [];
  const sceneManager = { setScene: (nextScene) => scenes.push(nextScene) };
  const scene = new PlayerSelectScene({ sceneManager, levels: [harborLevel], seed: 0, ...overrides });
  // First tick only captures the baseline, so run it once with neutral input before each test acts.
  scene.update(neutralInputs());
  return { scene, scenes };
}

test('a fresh jump press joins a player', () => {
  const { scene } = sceneWithBaseline();

  scene.update(inputsWithJump('red'));

  assert.equal(scene.stateByPlayerId.red, 'joined');
  assert.equal(scene.stateByPlayerId.blue, 'unjoined');
});

test('holding jump does not join or ready up more than once', () => {
  const { scene } = sceneWithBaseline();
  const heldJump = inputsWithJump('red');

  scene.update(heldJump);
  scene.update(heldJump);
  scene.update(heldJump);

  assert.equal(scene.stateByPlayerId.red, 'joined');
});

test('a second fresh press readies up a joined player', () => {
  const { scene } = sceneWithBaseline();

  scene.update(inputsWithJump('red'));
  scene.update(neutralInputs());
  scene.update(inputsWithJump('red'));

  assert.equal(scene.stateByPlayerId.red, 'ready');
});

test('a press held over from before this scene does not count as a fresh press', () => {
  const scenes = [];
  const sceneManager = { setScene: (nextScene) => scenes.push(nextScene) };
  const scene = new PlayerSelectScene({ sceneManager, levels: [harborLevel], seed: 0 });

  // Jump already held on the very first tick, carried over from confirming Versus on the title screen.
  scene.update(inputsWithJump('red'));
  assert.equal(scene.stateByPlayerId.red, 'unjoined', 'the baseline tick must not count as a press');

  scene.update(inputsWithJump('red'));
  assert.equal(scene.stateByPlayerId.red, 'unjoined', 'still held, so no fresh press yet');

  scene.update(neutralInputs());
  scene.update(inputsWithJump('red'));
  assert.equal(scene.stateByPlayerId.red, 'joined', 'released and pressed again is a fresh press');
});

test('the match does not start until both players are ready', () => {
  const { scene, scenes } = sceneWithBaseline();

  scene.update(inputsWithJump('red'));
  scene.update(neutralInputs());
  scene.update(inputsWithJump('red'));
  assert.equal(scene.stateByPlayerId.red, 'ready');
  assert.equal(scenes.length, 0, 'only one player is ready so far');

  scene.update(inputsWithJump('blue'));
  scene.update(neutralInputs());
  scene.update(inputsWithJump('blue'));
  assert.equal(scene.stateByPlayerId.blue, 'ready');

  assert.equal(scenes.length, 1, 'the match starts once every player is ready');
  assert.equal(scenes[0].constructor.name, 'PausableMatchScene');
  assert.equal(scenes[0].matchScene.constructor.name, 'VersusScene');
});

const otherLevel = { ...harborLevel, name: 'Dock' };
const twoLevels = [harborLevel, otherLevel];

function press(scene, playerId, button) {
  scene.update({ ...neutralInputs(), [playerId]: { ...noInput(), [button]: true } });
  scene.update(neutralInputs());
}

function pickedLevel({ seed, redPresses = [], bluePresses = [] }) {
  const { scene, scenes } = sceneWithBaseline({ levels: twoLevels, seed });
  press(scene, 'red', 'jump');
  press(scene, 'blue', 'jump');
  for (const button of redPresses) press(scene, 'red', button);
  for (const button of bluePresses) press(scene, 'blue', button);
  press(scene, 'red', 'jump');
  press(scene, 'blue', 'jump');
  return scenes[0].matchScene.level;
}

test('the same seed and votes give the same level', () => {
  for (let seed = 0; seed < 20; seed++) {
    assert.equal(pickedLevel({ seed }), pickedLevel({ seed }));
  }
});

test('a unanimous vote always picks that level', () => {
  for (let seed = 0; seed < 30; seed++) {
    assert.equal(pickedLevel({ seed, redPresses: ['left'], bluePresses: ['left'] }), otherLevel);
    assert.equal(pickedLevel({ seed, redPresses: ['left', 'left'], bluePresses: ['left', 'left'] }), harborLevel);
  }
});

test('Random can give any level', () => {
  const picked = new Set();
  for (let seed = 0; seed < 50; seed++) picked.add(pickedLevel({ seed }));

  assert.deepEqual([...picked].map((level) => level.name).sort(), ['Dock', 'Harbor']);
});

test('left and right change the vote only after joining and before readying', () => {
  const { scene } = sceneWithBaseline({ levels: twoLevels });
  const randomVote = scene.voteByPlayerId.red;

  press(scene, 'red', 'left');
  assert.equal(scene.voteByPlayerId.red, randomVote, 'unjoined players cannot vote');

  press(scene, 'red', 'jump');
  press(scene, 'red', 'left');
  assert.equal(scene.voteByPlayerId.red, 1);
  press(scene, 'red', 'right');
  assert.equal(scene.voteByPlayerId.red, randomVote);

  press(scene, 'red', 'jump');
  press(scene, 'red', 'left');
  assert.equal(scene.voteByPlayerId.red, randomVote, 'ready players cannot vote');
});
