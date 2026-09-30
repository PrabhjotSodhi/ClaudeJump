import assert from 'node:assert/strict';
import { test } from 'node:test';
import { menuRowRectangles } from '../src/ui/menu-kit.js';
import { TitleScene } from '../src/scenes/title-scene.js';
import { harborLevel } from './fixtures/harbor-level.mjs';

function noInput() {
  return { left: false, right: false, jump: false, up: false, down: false, action: false, confirm: false };
}

function neutralInputs() {
  return { red: noInput(), blue: noInput() };
}

function inputsWith(playerId, overrides) {
  const inputs = neutralInputs();
  inputs[playerId] = { ...noInput(), ...overrides };
  return inputs;
}

function inputsWithDown(playerId) {
  return inputsWith(playerId, { down: true });
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

test('a fresh confirm press confirms the selection and opens player select', () => {
  let scene;
  const scenes = [];
  const sceneManager = { setScene: (nextScene) => scenes.push(nextScene) };
  scene = new TitleScene({ sceneManager, levels: [harborLevel], seed: 0 });

  scene.update(inputsWith('red', { confirm: true }));

  assert.equal(scenes.length, 1);
  assert.equal(scenes[0].constructor.name, 'PlayerSelectScene');
});

test('a held confirm does not confirm more than once', () => {
  const scenes = [];
  const sceneManager = { setScene: (nextScene) => scenes.push(nextScene) };
  const scene = new TitleScene({ sceneManager, levels: [harborLevel], seed: 0 });
  const heldConfirm = inputsWith('red', { confirm: true });

  scene.update(heldConfirm);
  scene.update(heldConfirm);
  scene.update(heldConfirm);

  assert.equal(scenes.length, 1);
});

test('up moves the selection to the previous option and wraps from the first to the last', () => {
  const scene = new TitleScene({ options: threeOptions() });
  scene.selectedIndex = 1;

  scene.update(inputsWith('red', { up: true }));
  assert.equal(scene.selectedIndex, 0);

  scene.update(neutralInputs());
  scene.update(inputsWith('blue', { up: true }));
  assert.equal(scene.selectedIndex, 2);
});

test('jump does not select', () => {
  const scenes = [];
  const scene = new TitleScene({ sceneManager: { setScene: (nextScene) => scenes.push(nextScene) }, seed: 0 });

  scene.update(inputsWith('red', { jump: true }));
  scene.update(inputsWith('blue', { jump: true }));

  assert.equal(scenes.length, 0);
});

test('the title shows the sea at the Harbor water line', () => {
  const scene = new TitleScene({ levels: [harborLevel], seed: 0 });

  assert.equal(scene.waterLineY, harborLevel.waterLineY);
});

test('tapping a menu row selects and confirms it', () => {
  const scene = new TitleScene({ options: threeOptions() });
  scene.confirmSelection = function confirmSelection() {
    this.confirmed = this.selectedIndex;
  };
  const rows = menuRowRectangles(['A', 'B', 'C'], 176);

  scene.update(inputsWith('red', { tap: { x: 320, y: rows[2].y + 3 } }));

  assert.equal(scene.confirmed, 2);
});

function playersAfter(seed, tickCount) {
  const scene = new TitleScene({ seed });
  for (let tick = 0; tick < tickCount; tick++) scene.update(neutralInputs());
  return scene.brawl.players.map((player) => ({ id: player.id, x: player.x, y: player.y }));
}

test('the same seed puts the title characters in the same places after the same ticks', () => {
  assert.deepEqual(playersAfter(7, 900), playersAfter(7, 900));
});

test('different seeds play out differently', () => {
  assert.notDeepEqual(playersAfter(1, 900), playersAfter(2, 900));
});

test('the title characters fight: they shove each other and get knocked out and respawn', () => {
  const scene = new TitleScene({ seed: 3 });
  let shoves = 0;
  scene.brawl.events.on('player-shoved', () => shoves++);

  for (let tick = 0; tick < 3600; tick++) scene.update(neutralInputs());

  assert.ok(shoves > 0);
  assert.ok(scene.brawl.respawnCount > 0);
});

test('a title character that falls out drops back in from the top of the screen and lands', () => {
  const scene = new TitleScene({ seed: 0 });
  const red = scene.brawl.players.find((player) => player.id === 'red');
  red.y = 400;

  scene.update(neutralInputs());
  const returned = scene.brawl.players.find((player) => player.id === 'red');
  assert.notEqual(returned, red);
  assert.ok(returned.y + returned.height < 0);

  for (let tick = 0; tick < 120; tick++) scene.update(neutralInputs());
  assert.ok(scene.brawl.players.find((player) => player.id === 'red').y > 100);
});

function overlapsRectangle(player, rectangle) {
  return (
    player.x < rectangle.x + rectangle.width &&
    player.x + player.width > rectangle.x &&
    player.y < rectangle.y + rectangle.height &&
    player.y + player.height > rectangle.y
  );
}

test('four characters fight, at least three are on screen, and none cross the logo or the menu', () => {
  const scene = new TitleScene({ seed: 5 });
  const logo = { x: 220, y: 30, width: 200, height: 30 };
  const menu = { x: 270, y: 176, width: 100, height: 64 };
  assert.equal(scene.brawl.players.length, 4);

  for (let tick = 0; tick < 3600; tick++) {
    scene.update(neutralInputs());
    const onScreen = scene.brawl.players.filter((player) => player.y + player.height > 0);
    assert.ok(onScreen.length >= 3, `only ${onScreen.length} on screen at tick ${tick}`);
    for (const player of scene.brawl.players) {
      assert.ok(!overlapsRectangle(player, logo), `behind the logo at tick ${tick}`);
      assert.ok(!overlapsRectangle(player, menu), `behind the menu at tick ${tick}`);
    }
  }
});
