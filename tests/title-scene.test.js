import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TitleScene } from '../src/scenes/title-scene.js';

function noInput() {
  return { left: false, right: false, jump: false, down: false, card: false };
}

function neutralInputs() {
  return { red: noInput(), blue: noInput() };
}

function inputsWithDown(playerId) {
  const inputs = neutralInputs();
  inputs[playerId] = { ...noInput(), down: true };
  return inputs;
}

function inputsWithJump(playerId) {
  const inputs = neutralInputs();
  inputs[playerId] = { ...noInput(), jump: true };
  return inputs;
}

function threeOptions() {
  return [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ];
}

test('down moves the selection to the next option', () => {
  const scene = new TitleScene({ options: threeOptions() });
  assert.equal(scene.selectedIndex, 0);

  scene.update(inputsWithDown('red'));

  assert.equal(scene.selectedIndex, 1);
});

test('down wraps from the last option back to the first', () => {
  const scene = new TitleScene({ options: threeOptions() });
  scene.selectedIndex = 2;

  scene.update(inputsWithDown('blue'));

  assert.equal(scene.selectedIndex, 0);
});

test('either player can move the selection with down', () => {
  const scene = new TitleScene({ options: threeOptions() });

  scene.update(inputsWithDown('blue'));

  assert.equal(scene.selectedIndex, 1);
});

test('holding down does not repeat every tick', () => {
  const scene = new TitleScene({ options: threeOptions() });
  const heldDown = inputsWithDown('red');

  scene.update(heldDown);
  scene.update(heldDown);
  scene.update(heldDown);

  assert.equal(scene.selectedIndex, 1);
});

test('a fresh jump press confirms the selection and opens player select', () => {
  let scene;
  const scenes = [];
  const sceneManager = { setScene: (nextScene) => scenes.push(nextScene) };
  scene = new TitleScene({ sceneManager, seed: 0 });

  scene.update(inputsWithJump('red'));

  assert.equal(scenes.length, 1);
  assert.equal(scenes[0].constructor.name, 'PlayerSelectScene');
});

test('a held jump does not confirm more than once', () => {
  const scenes = [];
  const sceneManager = { setScene: (nextScene) => scenes.push(nextScene) };
  const scene = new TitleScene({ sceneManager, seed: 0 });
  const heldJump = inputsWithJump('red');

  scene.update(heldJump);
  scene.update(heldJump);
  scene.update(heldJump);

  assert.equal(scenes.length, 1);
});
