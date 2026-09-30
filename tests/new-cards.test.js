import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crateCardFor, CARD_NAMES } from '../src/cards/card-definitions.js';
import { CARD_CRATE_WEIGHTS, FREEZE_TICKS, MAGNET_TICKS, SPRING_SHOES_JUMPS } from '../src/engine/config.js';
import { stateHash } from '../src/engine/state-hash.js';
import { CHARACTERS } from '../src/entities/characters.js';
import { PLAYERS } from '../src/levels/versus-arena.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { harborLevel } from './fixtures/harbor-level.mjs';

const IDLE = { left: false, right: false, jump: false };
// Harbor's left island runs from x 80 to 256, with its top at y 224.
const ISLAND_TOP_Y = 224;

function fightScene(playerCount = 2) {
  const players = PLAYERS.slice(0, playerCount).map(({ id }, index) => ({ id, character: CHARACTERS[index] }));
  return new VersusScene({ level: harborLevel, startInFightPhase: true, seed: 3, players });
}

function findPlayer(scene, id) {
  return scene.players.find((player) => player.id === id);
}

function inputs(scene, inputByPlayerId = {}) {
  return Object.fromEntries(scene.players.map(({ id }) => [id, inputByPlayerId[id] ?? IDLE]));
}

function advance(scene, tickCount, inputByPlayerId) {
  for (let tick = 0; tick < tickCount; tick++) scene.update(inputs(scene, inputByPlayerId));
}

function standOnIsland(player, x) {
  player.x = x;
  player.y = ISLAND_TOP_Y - player.height;
  player.velocityX = 0;
  player.velocityY = 0;
}

function playCard(scene, player, cardName) {
  player.heldCardName = cardName;
  player.heldCardUsesRemaining = 1;
  advance(scene, 1);
  advance(scene, 1, { [player.id]: { ...IDLE, action: true } });
}

// The highest point a player reaches after pressing jump on the ground and holding it.
function jumpPeakY(scene, player) {
  const startY = player.y;
  let peakY = startY;
  for (let tick = 0; tick < 60; tick++) {
    scene.update(inputs(scene, { [player.id]: { ...IDLE, jump: true } }));
    peakY = Math.min(peakY, player.y);
  }
  advance(scene, 60);
  return startY - peakY;
}

test('crates draw every card, each by its weight in config', () => {
  const counts = Object.fromEntries(CARD_NAMES.map((cardName) => [cardName, 0]));
  const rollCount = 8000;
  for (let roll = 0; roll < rollCount; roll++) counts[crateCardFor(roll / rollCount)]++;

  const totalWeight = Object.values(CARD_CRATE_WEIGHTS).reduce((total, weight) => total + weight, 0);
  for (const cardName of ['magnet', 'springShoes', 'freeze']) {
    assert.equal(counts[cardName], (rollCount * CARD_CRATE_WEIGHTS[cardName]) / totalWeight, cardName);
  }
});

test('a magnet pulls every other player toward the player who played it for one second', () => {
  const scene = fightScene(4);
  const [red, blue, green, yellow] = scene.players;
  standOnIsland(red, 150);
  standOnIsland(blue, 230);
  standOnIsland(green, 90);
  yellow.x = 480;
  const yellowStartX = yellow.x;
  const pulls = [];
  scene.events.on('magnet-pulled', (event) => pulls.push(event));

  playCard(scene, red, 'magnet');
  advance(scene, 15);

  assert.deepEqual(pulls, [{ playerId: red.id, targetIds: [blue.id, green.id, yellow.id] }]);
  assert.ok(blue.x < 230 - 30, 'blue slides left toward red');
  assert.ok(green.x > 90 + 30, 'green slides right toward red');
  assert.ok(yellow.x < yellowStartX - 30, 'yellow on the other island is pulled too');
  assert.equal(red.x, 150, 'the magnet never moves its owner');

  advance(scene, MAGNET_TICKS);
  const blueStoppedX = blue.x;
  advance(scene, 30);
  assert.equal(blue.x, blueStoppedX, 'the pull ends after its time');
});

test('spring shoes make the next three jumps twice as high, then jumps go back to normal', () => {
  const scene = fightScene();
  const red = findPlayer(scene, 'red');
  standOnIsland(red, 150);
  advance(scene, 5);
  const normalHeight = jumpPeakY(scene, red);

  const springJumps = [];
  scene.events.on('spring-jumped', (event) => springJumps.push(event));
  playCard(scene, red, 'springShoes');
  const springHeights = [];
  for (let jump = 0; jump < SPRING_SHOES_JUMPS; jump++) {
    standOnIsland(red, 150);
    advance(scene, 5);
    springHeights.push(jumpPeakY(scene, red));
  }
  standOnIsland(red, 150);
  advance(scene, 5);
  const afterHeight = jumpPeakY(scene, red);

  for (const height of springHeights) {
    assert.ok(Math.abs(height / normalHeight - 2) < 0.15, `spring jump of ${height} vs normal ${normalHeight}`);
  }
  assert.equal(springJumps.length, SPRING_SHOES_JUMPS);
  assert.equal(afterHeight, normalHeight);
});

test('an ice shot freezes the first player it hits for one second', () => {
  const scene = fightScene(3);
  const [red, blue, green] = scene.players;
  standOnIsland(red, 90);
  standOnIsland(blue, 160);
  standOnIsland(green, 220);
  const icings = [];
  scene.events.on('player-iced', (event) => icings.push(event));

  playCard(scene, red, 'freeze');
  for (let tick = 0; tick < 30 && icings.length === 0; tick++) advance(scene, 1);

  assert.equal(icings.length, 1);
  assert.equal(icings[0].targetId, blue.id);
  assert.equal(green.isIced, false, 'the shot stops on the first player');
  assert.equal(scene.entityGroups.get('iceShots').length, 0);

  const frozenX = blue.x;
  advance(scene, FREEZE_TICKS - 1, { [blue.id]: { ...IDLE, left: true, jump: true } });
  assert.equal(blue.x, frozenX, 'a frozen player cannot move');
  assert.equal(blue.isIced, true);

  advance(scene, 1);
  assert.equal(blue.isIced, false);
  advance(scene, 10, { [blue.id]: { ...IDLE, left: true } });
  assert.ok(blue.x < frozenX, 'the player moves again once thawed');
});

test('a frozen player slides much farther on a shove', () => {
  function shoveDistance(iced) {
    const scene = fightScene();
    const red = findPlayer(scene, 'red');
    const blue = findPlayer(scene, 'blue');
    standOnIsland(red, 90);
    standOnIsland(blue, 120);
    red.facing = 1;
    advance(scene, 2);
    if (iced) blue.freezeSolid();
    const startX = blue.x;
    advance(scene, 1, { red: { ...IDLE, action: true } });
    advance(scene, 3);
    advance(scene, 20);
    return blue.x - startX;
  }

  assert.ok(shoveDistance(true) > shoveDistance(false) * 2);
});

test('the same inputs with the new cards give the same state', () => {
  function run() {
    const scene = fightScene(4);
    const [red, blue, green] = scene.players;
    standOnIsland(red, 90);
    standOnIsland(blue, 160);
    standOnIsland(green, 230);
    playCard(scene, red, 'freeze');
    playCard(scene, green, 'magnet');
    playCard(scene, blue, 'springShoes');
    advance(scene, 40, { [blue.id]: { ...IDLE, jump: true } });
    return stateHash(scene);
  }

  assert.equal(run(), run());
});
