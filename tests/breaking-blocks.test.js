import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HITSTOP_TICKS, LEVEL_COLUMNS, LEVEL_ROWS, SHOVE_WINDUP_TICKS } from '../src/engine/config.js';
import { Bomb } from '../src/entities/bomb.js';
import { BouncePad } from '../src/entities/bounce-pad.js';
import { buildLevel } from '../src/levels/level-loader.js';
import { VersusScene } from '../src/scenes/versus-scene.js';

const READY_TICKS = 60;
const FLOOR_ROW = 10;
const FLOOR_Y = FLOOR_ROW * 16;
const PLAYER_HEIGHT = 28;

function noInput() {
  return { left: false, right: false, jump: false };
}

function inputs(redInput = noInput()) {
  return { red: redInput, blue: noInput() };
}

function advance(scene, tickCount, redInput) {
  for (let tick = 0; tick < tickCount; tick++) scene.update(inputs(redInput));
}

// Blue always stands safe on its own small floor at the right edge.
function fightingScene(rows) {
  const grid = Array.from({ length: LEVEL_ROWS }, (_, row) => (rows[row] ?? '').padEnd(LEVEL_COLUMNS, '.'));
  grid[FLOOR_ROW] = grid[FLOOR_ROW].slice(0, 35) + 'ss' + grid[FLOOR_ROW].slice(37);
  const level = buildLevel({
    name: 'Test',
    grid,
    spawns: [
      { id: 'red', x: 148, y: FLOOR_Y, facing: 1 },
      { id: 'blue', x: 572, y: FLOOR_Y, facing: -1 },
    ],
    waterLineY: 300,
    suddenDeathLineY: 200,
  });
  const scene = new VersusScene({ level, seed: 1 });
  advance(scene, READY_TICKS);
  return scene;
}

function isSolidAt(scene, x, y) {
  return scene.entityGroups
    .get('platforms')
    .some(
      (platform) =>
        x >= platform.x && x < platform.x + platform.width && y >= platform.y && y < platform.y + platform.height,
    );
}

function red(scene) {
  return scene.players.find((player) => player.id === 'red');
}

function playHeldCard(scene, cardName) {
  red(scene).heldCardName = cardName;
  red(scene).heldCardUsesRemaining = 3;
  advance(scene, 1); // release the action key held from spawn
  advance(scene, 1, { ...noInput(), action: true });
}

// Drops a bomb that touches the floor and goes off on the next tick.
function detonateBombAt(scene, x) {
  scene.entityGroups.add('bombs', new Bomb({ x, y: FLOOR_Y + 2, facing: 1, throwerId: 'blue' }));
  advance(scene, 1 + HITSTOP_TICKS.heavy);
}

test('a bomb blast breaks the blocks inside its radius and leaves the rest', () => {
  const scene = fightingScene({ [FLOOR_ROW]: '.....ssssssssssssssss' });
  const events = [];
  scene.events.on('block-broken', (event) => events.push(event));

  detonateBombAt(scene, 200);

  assert.ok(!isSolidAt(scene, 208, FLOOR_Y + 8), 'the block under the bomb broke');
  assert.ok(!isSolidAt(scene, 184, FLOOR_Y + 8), 'a block inside the radius broke');
  assert.ok(isSolidAt(scene, 152, FLOOR_Y + 8), 'a block just outside the radius stayed');
  assert.ok(isSolidAt(scene, 88, FLOOR_Y + 8), 'a block far to the left stayed');
  assert.ok(isSolidAt(scene, 328, FLOOR_Y + 8), 'a block far to the right stayed');
  assert.ok(events.length > 1);
  assert.deepEqual(events[0], { x: events[0].x, y: FLOOR_Y, size: 16 });
});

test('a shove breaks the block in front of the shover', () => {
  const scene = fightingScene({ 9: '..........s', [FLOOR_ROW]: '.....ssssssssssssssss' });
  assert.ok(isSolidAt(scene, 168, 152));

  advance(scene, 1);
  advance(scene, 1, { ...noInput(), action: true });
  advance(scene, SHOVE_WINDUP_TICKS + 1);

  assert.ok(!isSolidAt(scene, 168, 152), 'the block in front broke');
  assert.ok(isSolidAt(scene, 168, FLOOR_Y + 8), 'the floor under the shover stayed');
});

test('a dash breaks the blocks in its way', () => {
  const scene = fightingScene({ 9: '..........s', [FLOOR_ROW]: '.....ssssssssssssssss' });

  playHeldCard(scene, 'dash');
  advance(scene, 3);

  assert.ok(!isSolidAt(scene, 168, 152));
});

test('a player standing on a block that breaks falls through', () => {
  const scene = fightingScene({ [FLOOR_ROW]: '........sss' });
  const startY = red(scene).y;

  detonateBombAt(scene, 148);
  advance(scene, 40);

  assert.ok(red(scene).y > startY + PLAYER_HEIGHT, 'red dropped below the floor');
});

test('a girder inside a blast stays', () => {
  const scene = fightingScene({ [FLOOR_ROW]: '........====s' });

  detonateBombAt(scene, 176);

  assert.ok(!isSolidAt(scene, 200, FLOOR_Y + 8), 'the block next to the girder broke');
  assert.ok(isSolidAt(scene, 136, FLOOR_Y + 8), 'the girder stayed');
  assert.ok(isSolidAt(scene, 168, FLOOR_Y + 8), 'the girder stayed');
});

test('the next round starts with every block back', () => {
  const scene = fightingScene({ 9: '..........s', [FLOOR_ROW]: '.....ssssssssssssssss' });
  advance(scene, 1);
  advance(scene, 1, { ...noInput(), action: true });
  advance(scene, SHOVE_WINDUP_TICKS + 1);
  assert.ok(!isSolidAt(scene, 168, 152));

  scene.players.find((player) => player.id === 'blue').y = 600;
  advance(scene, 1);
  advance(scene, 90);

  assert.equal(scene.phase, 'ready');
  assert.ok(isSolidAt(scene, 168, 152), 'the broken block is back');
  assert.ok(scene.level.solidCells[9][10], 'the shared level was never changed');
});

test('the same inputs twice give the same arena', () => {
  function playArena() {
    const scene = fightingScene({ 9: '..........s', [FLOOR_ROW]: '.....ssssssssssssssss' });
    playHeldCard(scene, 'bomb');
    advance(scene, 30);
    advance(scene, 1, { ...noInput(), action: true });
    advance(scene, 30);
    return scene.entityGroups.get('platforms').map(({ x, y, width, height }) => ({ x, y, width, height }));
  }

  const first = playArena();
  assert.notDeepEqual(
    first,
    fightingScene({ 9: '..........s', [FLOOR_ROW]: '.....ssssssssssssssss' })
      .entityGroups.get('platforms')
      .map(({ x, y, width, height }) => ({ x, y, width, height })),
  );
  assert.deepEqual(playArena(), first);
});

test('a bounce pad goes when the block under it breaks, and stays while another block holds it', () => {
  const scene = fightingScene({ [FLOOR_ROW]: '.....ssssssssssssssss' });
  const heldPad = new BouncePad({ x: 256, y: FLOOR_Y - 6, lifetimeTicks: Infinity });
  const droppedPad = new BouncePad({ x: 200, y: FLOOR_Y - 6, lifetimeTicks: Infinity });
  scene.entityGroups.add('bouncePads', heldPad);
  scene.entityGroups.add('bouncePads', droppedPad);

  detonateBombAt(scene, 200);

  assert.ok(!scene.entityGroups.get('bouncePads').includes(droppedPad), 'the pad over the blast fell away');
  assert.ok(scene.entityGroups.get('bouncePads').includes(heldPad), 'the pad on intact blocks stayed');
});
