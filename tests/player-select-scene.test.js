import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHARACTERS } from '../src/entities/characters.js';
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

  assert.equal(scene.stateByPlayerId.red, 'picking');
  assert.equal(scene.stateByPlayerId.blue, 'unjoined');
});

test('holding jump does not join or ready up more than once', () => {
  const { scene } = sceneWithBaseline();
  const heldJump = inputsWithJump('red');

  scene.update(heldJump);
  scene.update(heldJump);
  scene.update(heldJump);

  assert.equal(scene.stateByPlayerId.red, 'picking');
});

test('each fresh jump press moves a player from picking to voting to ready', () => {
  const { scene } = sceneWithBaseline();

  scene.update(inputsWithJump('red'));
  scene.update(neutralInputs());
  scene.update(inputsWithJump('red'));
  assert.equal(scene.stateByPlayerId.red, 'voting');

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
  assert.equal(scene.stateByPlayerId.red, 'picking', 'released and pressed again is a fresh press');
});

test('the match does not start until both players are ready', () => {
  const { scene, scenes } = sceneWithBaseline();

  readyUp(scene, 'red');
  assert.equal(scene.stateByPlayerId.red, 'ready');
  assert.equal(scenes.length, 0, 'only one player is ready so far');

  readyUp(scene, 'blue');
  assert.equal(scene.stateByPlayerId.blue, 'ready');

  assert.equal(scenes.length, 1, 'the match starts once every player is ready');
  assert.equal(scenes[0].constructor.name, 'PausableMatchScene');
  assert.equal(scenes[0].matchScene.constructor.name, 'VersusScene');
});

function press(scene, playerId, button) {
  scene.update({ ...neutralInputs(), [playerId]: { ...noInput(), [button]: true } });
  scene.update(neutralInputs());
}

// The last press has no release after it, because the scene is replaced the moment everyone is ready.
function readyUp(scene, playerId) {
  press(scene, playerId, 'jump');
  press(scene, playerId, 'jump');
  scene.update(inputsWithJump(playerId));
}

const otherLevel = { ...harborLevel, name: 'Dock' };
const twoLevels = [harborLevel, otherLevel];

function pickedLevel({ seed, redPresses = [], bluePresses = [] }) {
  const { scene, scenes } = sceneWithBaseline({ levels: twoLevels, seed });
  for (const playerId of ['red', 'blue']) {
    press(scene, playerId, 'jump');
    press(scene, playerId, 'jump');
  }
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

test('left and right change the vote only while voting', () => {
  const { scene } = sceneWithBaseline({ levels: twoLevels });
  const randomVote = scene.voteByPlayerId.red;

  press(scene, 'red', 'left');
  assert.equal(scene.voteByPlayerId.red, randomVote, 'unjoined players cannot vote');

  press(scene, 'red', 'jump');
  press(scene, 'red', 'left');
  assert.equal(scene.voteByPlayerId.red, randomVote, 'picking a character does not change the vote');

  press(scene, 'red', 'jump');
  press(scene, 'red', 'left');
  assert.equal(scene.voteByPlayerId.red, 1);
  press(scene, 'red', 'right');
  assert.equal(scene.voteByPlayerId.red, randomVote);

  press(scene, 'red', 'jump');
  press(scene, 'red', 'left');
  assert.equal(scene.voteByPlayerId.red, randomVote, 'ready players cannot vote');
});

function hoveredCharacterName(scene, playerId) {
  return CHARACTERS[scene.characterIndexByPlayerId[playerId]].name;
}

test('red starts hovering on Claude and blue on Muse', () => {
  const { scene } = sceneWithBaseline();

  assert.equal(hoveredCharacterName(scene, 'red'), 'claude');
  assert.equal(hoveredCharacterName(scene, 'blue'), 'muse');
});

test('left and right cycle the hovered character while picking', () => {
  const { scene } = sceneWithBaseline();
  press(scene, 'red', 'jump');

  press(scene, 'red', 'right');
  press(scene, 'red', 'right');
  assert.equal(hoveredCharacterName(scene, 'red'), 'chatgpt');

  press(scene, 'red', 'left');
  press(scene, 'red', 'left');
  press(scene, 'red', 'left');
  assert.equal(hoveredCharacterName(scene, 'red'), CHARACTERS.at(-1).name, 'wraps around the list');
});

test('the picker skips a character the other player has locked in', () => {
  const { scene } = sceneWithBaseline();
  press(scene, 'red', 'jump');
  press(scene, 'red', 'jump');
  press(scene, 'blue', 'jump');

  press(scene, 'blue', 'left');

  assert.equal(scene.stateByPlayerId.red, 'voting');
  assert.equal(hoveredCharacterName(scene, 'blue'), CHARACTERS.at(-1).name, 'Claude is locked, so blue steps past it');
});

test('a player hovering on a character the other player locks in moves to the next free one', () => {
  const { scene } = sceneWithBaseline();
  press(scene, 'blue', 'jump');
  press(scene, 'red', 'jump');
  press(scene, 'red', 'right');
  assert.equal(hoveredCharacterName(scene, 'blue'), 'muse', 'hovering is not locking, so red may hover on Muse too');

  press(scene, 'red', 'jump');

  assert.equal(hoveredCharacterName(scene, 'red'), 'muse');
  assert.equal(hoveredCharacterName(scene, 'blue'), 'chatgpt');
  assert.equal(scene.stateByPlayerId.blue, 'picking');
});

test('a match started from player select gives each player the picked character and its tag color', () => {
  const { scene, scenes } = sceneWithBaseline();
  press(scene, 'blue', 'jump');
  press(scene, 'red', 'jump');
  press(scene, 'red', 'right');
  press(scene, 'red', 'jump');
  press(scene, 'red', 'jump');
  press(scene, 'blue', 'jump');
  press(scene, 'blue', 'jump');

  const players = scenes[0].matchScene.players;
  const red = players.find((player) => player.id === 'red');
  const blue = players.find((player) => player.id === 'blue');

  assert.deepEqual([red.character.name, red.color], ['muse', '#ead4aa']);
  assert.deepEqual([blue.character.name, blue.color], ['chatgpt', '#63c74d']);
});
