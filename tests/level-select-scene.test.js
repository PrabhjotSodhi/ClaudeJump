import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { findCharacter } from '../src/entities/characters.js';
import { measureText } from '../src/ui/text.js';
import { LevelSelectScene, levelSelectLayout } from '../src/scenes/level-select-scene.js';
import { harborLevel } from './fixtures/harbor-level.mjs';

const otherLevel = { ...harborLevel, name: 'Dock' };
const twoLevels = [harborLevel, otherLevel];
const RANDOM_TILE = twoLevels.length;
const pickedCharacters = { red: findCharacter('muse'), blue: findCharacter('chatgpt') };
// Well past the short pause on the picked tile, so a match that never starts fails instead of hanging.
const MOST_TICKS_BEFORE_MATCH = 120;

function noInput() {
  return { left: false, right: false, jump: false, down: false, action: false };
}

function neutralInputs() {
  return { red: noInput(), blue: noInput() };
}

function sceneWithBaseline({ levels = twoLevels, seed = 0 } = {}) {
  const scenes = [];
  const sceneManager = { setScene: (nextScene) => scenes.push(nextScene) };
  const scene = new LevelSelectScene({ sceneManager, levels, characterByPlayerId: pickedCharacters, seed });
  // First tick only captures the baseline, so run it once with neutral input before each test acts.
  scene.update(neutralInputs());
  return { scene, scenes };
}

function press(scene, playerId, button) {
  scene.update({ ...neutralInputs(), [playerId]: { ...noInput(), [button]: true } });
  scene.update(neutralInputs());
}

function ticksUntilMatch(scene, scenes) {
  let ticks = 0;
  while (scenes.length === 0 && ticks < MOST_TICKS_BEFORE_MATCH) {
    scene.update(neutralInputs());
    ticks++;
  }
  return ticks;
}

test('both cursors start on the Random tile', () => {
  const { scene } = sceneWithBaseline();

  assert.deepEqual(scene.cursorByPlayerId, { red: RANDOM_TILE, blue: RANDOM_TILE });
});

test('left and right move a cursor and wrap around the tiles', () => {
  const { scene } = sceneWithBaseline();

  press(scene, 'red', 'right');
  assert.equal(scene.cursorByPlayerId.red, 0, 'right from Random wraps to the first level');
  press(scene, 'red', 'left');
  assert.equal(scene.cursorByPlayerId.red, RANDOM_TILE, 'left from the first level wraps to Random');
  press(scene, 'red', 'left');
  assert.equal(scene.cursorByPlayerId.red, 1);

  assert.equal(scene.cursorByPlayerId.blue, RANDOM_TILE, 'the other cursor does not move');
});

test('jump locks only that player, and a locked cursor stays put', () => {
  const { scene } = sceneWithBaseline();

  press(scene, 'red', 'left');
  press(scene, 'red', 'jump');
  press(scene, 'red', 'left');

  assert.deepEqual(scene.lockedByPlayerId, { red: true, blue: false });
  assert.equal(scene.cursorByPlayerId.red, 1);

  press(scene, 'blue', 'left');
  assert.equal(scene.cursorByPlayerId.blue, 1, 'the unlocked player still moves');
});

test('a jump still held from player select does not lock a vote', () => {
  const scenes = [];
  const sceneManager = { setScene: (nextScene) => scenes.push(nextScene) };
  const scene = new LevelSelectScene({ sceneManager, levels: twoLevels, characterByPlayerId: pickedCharacters });
  const heldJump = { ...neutralInputs(), red: { ...noInput(), jump: true } };

  scene.update(heldJump);
  scene.update(heldJump);

  assert.equal(scene.lockedByPlayerId.red, false);
});

test('once both lock, the match waits on the picked tile, then starts with that level and the picked characters', () => {
  const { scene, scenes } = sceneWithBaseline();
  press(scene, 'red', 'left');
  press(scene, 'blue', 'left');
  press(scene, 'red', 'jump');
  press(scene, 'blue', 'jump');

  assert.equal(scenes.length, 0, 'the picked tile shows before the match starts');
  assert.equal(scene.pickedLevel, otherLevel);

  const ticks = ticksUntilMatch(scene, scenes);
  assert.ok(ticks > 30 && ticks < MOST_TICKS_BEFORE_MATCH, `started after ${ticks} ticks, about a second expected`);

  const matchScene = scenes[0].matchScene;
  assert.equal(scenes[0].constructor.name, 'PausableMatchScene');
  assert.equal(matchScene.level, otherLevel);
  const red = matchScene.players.find((player) => player.id === 'red');
  const blue = matchScene.players.find((player) => player.id === 'blue');
  assert.deepEqual([red.character.name, red.color], ['muse', '#ead4aa']);
  assert.deepEqual([blue.character.name, blue.color], ['chatgpt', '#63c74d']);
});

function pickedLevel({ seed, redPresses = [], bluePresses = [] }) {
  const { scene, scenes } = sceneWithBaseline({ seed });
  for (const button of redPresses) press(scene, 'red', button);
  for (const button of bluePresses) press(scene, 'blue', button);
  press(scene, 'red', 'jump');
  press(scene, 'blue', 'jump');
  ticksUntilMatch(scene, scenes);
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
    assert.equal(pickedLevel({ seed, redPresses: ['right'], bluePresses: ['right'] }), harborLevel);
  }
});

test('Random can give any level', () => {
  const picked = new Set();
  for (let seed = 0; seed < 50; seed++) picked.add(pickedLevel({ seed }));

  assert.deepEqual([...picked].map((level) => level.name).sort(), ['Dock', 'Harbor']);
});

test('the grid fits the screen with no overlap for 4 to 8 cards, on whole pixels', () => {
  for (let cardCount = 4; cardCount <= 8; cardCount++) {
    const { bounds } = levelSelectLayout(cardCount);
    assert.equal(bounds.length, cardCount);
    bounds.forEach((box, index) => {
      const label = `${cardCount} cards, card ${index}`;
      for (const value of [box.x, box.y, box.width, box.height]) assert.ok(Number.isInteger(value), label);
      assert.ok(box.x >= 0 && box.y >= 0, `${label} starts on screen`);
      assert.ok(box.x + box.width <= 640 && box.y + box.height <= 360, `${label} ends on screen`);
      for (const other of bounds.slice(index + 1)) {
        const apart =
          box.x + box.width <= other.x ||
          other.x + other.width <= box.x ||
          box.y + box.height <= other.y ||
          other.y + other.height <= box.y;
        assert.ok(apart, `${label} overlaps another card`);
      }
    });
  }
});

test('every level name and the Random label fit under their tile', () => {
  const levelsFolder = new URL('../data/levels/', import.meta.url);
  const names = readdirSync(levelsFolder)
    .filter((fileName) => fileName.endsWith('.json'))
    .map((fileName) => JSON.parse(readFileSync(new URL(fileName, levelsFolder))).name);
  const { bounds } = levelSelectLayout(names.length + 1);

  for (const name of [...names, 'Random']) {
    assert.ok(measureText(name) <= bounds[0].width, `${name} is wider than its tile`);
  }
});

function sceneWithLevels(levelCount) {
  const levels = Array.from({ length: levelCount }, (_, index) => ({ ...harborLevel, name: `Level ${index}` }));
  return sceneWithBaseline({ levels }).scene;
}

test('down moves along the column and wraps to the top', () => {
  const scene = sceneWithLevels(7);

  press(scene, 'red', 'right');
  press(scene, 'red', 'right');
  assert.equal(scene.cursorByPlayerId.red, 5, 'right from Random wraps to the start of its row, then one on');
  press(scene, 'red', 'down');
  assert.equal(scene.cursorByPlayerId.red, 1, 'below the last row wraps to the first row');
  press(scene, 'red', 'down');
  assert.equal(scene.cursorByPlayerId.red, 5);

  assert.equal(scene.cursorByPlayerId.blue, 7, 'the other cursor does not move');
});

test('left and right stay inside their row, including a shorter last row', () => {
  const scene = sceneWithLevels(6);
  const randomTile = 6;

  press(scene, 'red', 'right');
  assert.equal(scene.cursorByPlayerId.red, 4, 'right from the end of the last row wraps to its start');
  press(scene, 'red', 'left');
  assert.equal(scene.cursorByPlayerId.red, randomTile);

  press(scene, 'blue', 'down');
  assert.equal(scene.cursorByPlayerId.blue, 2, 'down from Random goes to the top of its column');
  press(scene, 'blue', 'right');
  press(scene, 'blue', 'down');
  assert.equal(scene.cursorByPlayerId.blue, 3, 'a column with no card in the last row stays in the first row');
});
