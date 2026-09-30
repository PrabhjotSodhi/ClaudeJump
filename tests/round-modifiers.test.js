import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BANANA_RAIN_WARNING_TICKS,
  MODIFIER_PICK_TICKS,
  ROUND_MODIFIERS,
  ROUND_COUNTDOWN_TICKS,
} from '../src/engine/config.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { harborLevel } from './fixtures/harbor-level.mjs';

const IDLE = { left: false, right: false, jump: false };
const NO_INPUT = { red: IDLE, blue: IDLE };
const MODIFIER_IDS = Object.keys(ROUND_MODIFIERS);

function advance(scene, tickCount, inputs = NO_INPUT) {
  for (let tick = 0; tick < tickCount; tick++) scene.update(inputs);
}

function advanceWhile(scene, condition, inputs = NO_INPUT) {
  for (let tick = 0; tick < 2000 && condition(); tick++) scene.update(inputs);
}

function findPlayer(scene, id) {
  return scene.players.find((player) => player.id === id);
}

function playRound(scene, loserId) {
  advanceWhile(scene, () => scene.phase === 'ready');
  findPlayer(scene, loserId).y = 600;
  advanceWhile(scene, () => ['fight', 'knockout', 'point'].includes(scene.phase));
}

function sceneAtPick(loserIds, seed = 7) {
  const scene = new VersusScene({ level: harborLevel, seed });
  for (const loserId of loserIds) playRound(scene, loserId);
  return scene;
}

function sceneInFightWith(modifierId) {
  const scene = sceneAtPick(['blue', 'blue']);
  scene.modifierOptionIds = [modifierId, MODIFIER_IDS.find((id) => id !== modifierId)];
  advance(scene, MODIFIER_PICK_TICKS);
  advanceWhile(scene, () => scene.phase === 'ready');
  assert.equal(scene.activeModifierId, modifierId);
  return scene;
}

function plainFight() {
  const scene = new VersusScene({ level: harborLevel, seed: 7 });
  advanceWhile(scene, () => scene.phase === 'ready');
  return scene;
}

test('rounds 1 and 2 start without a pick, and the pick comes before round 3', () => {
  const scene = new VersusScene({ level: harborLevel, seed: 7 });
  playRound(scene, 'blue');
  assert.equal(scene.phase, 'ready');
  assert.equal(scene.activeModifierId, null);
  playRound(scene, 'blue');
  assert.equal(scene.phase, 'modifier');
});

test('the player with the fewest wins picks', () => {
  assert.equal(sceneAtPick(['blue', 'blue']).modifierPickerId, 'blue');
  assert.equal(sceneAtPick(['red', 'red']).modifierPickerId, 'red');
});

test('a tie goes to the first seat', () => {
  assert.equal(sceneAtPick(['blue', 'red']).modifierPickerId, 'red');
});

test('two different modifiers are offered, and the same seed offers the same two', () => {
  const scene = sceneAtPick(['blue', 'blue']);
  const [first, second] = scene.modifierOptionIds;
  assert.notEqual(first, second);
  assert.ok(MODIFIER_IDS.includes(first) && MODIFIER_IDS.includes(second));
  assert.deepEqual(sceneAtPick(['blue', 'blue']).modifierOptionIds, [first, second]);
});

test('only the picking player chooses', () => {
  const scene = sceneAtPick(['blue', 'blue']);
  const [, secondOption] = scene.modifierOptionIds;
  advance(scene, 2);
  advance(scene, 3, { red: { left: false, right: true, jump: true }, blue: IDLE });
  assert.equal(scene.phase, 'modifier', 'the other player cannot choose or confirm');
  assert.equal(scene.modifierHighlight, 0);

  scene.update({ red: IDLE, blue: { left: false, right: true, jump: false } });
  scene.update({ red: IDLE, blue: { left: false, right: true, jump: true } });
  assert.equal(scene.phase, 'ready');
  assert.equal(scene.activeModifierId, secondOption);
});

test('a jump held from the last round does not confirm the pick', () => {
  const scene = sceneAtPick(['blue', 'blue']);
  advance(scene, 5, { red: IDLE, blue: { left: false, right: false, jump: true } });
  assert.equal(scene.phase, 'modifier');
});

test('the highlighted modifier is taken when the pick time runs out', () => {
  const scene = sceneAtPick(['blue', 'blue']);
  const [firstOption] = scene.modifierOptionIds;
  advance(scene, MODIFIER_PICK_TICKS);
  assert.equal(scene.phase, 'ready');
  assert.equal(scene.activeModifierId, firstOption);
});

test('the modifier lasts one round', () => {
  const scene = sceneInFightWith('lowGravity');
  findPlayer(scene, 'red').y = 600;
  advanceWhile(scene, () => ['fight', 'knockout', 'point'].includes(scene.phase));
  assert.equal(scene.phase, 'ready');
  assert.equal(scene.activeModifierId, null);
});

test('low gravity lets a jump go higher', () => {
  function jumpApex(scene) {
    const player = findPlayer(scene, 'red');
    const startY = player.y;
    let apex = startY;
    for (let tick = 0; tick < 90; tick++) {
      scene.update({ red: { left: false, right: false, jump: tick >= 1 && tick < 20 }, blue: IDLE });
      apex = Math.min(apex, player.y);
    }
    return startY - apex;
  }
  const normalJump = jumpApex(plainFight());
  const floatyJump = jumpApex(sceneInFightWith('lowGravity'));
  assert.ok(floatyJump > normalJump * 1.3, `${floatyJump} should beat ${normalJump}`);
});

test('slippery floors make players slide further after letting go', () => {
  function slideDistance(scene) {
    const player = findPlayer(scene, 'red');
    advance(scene, 40, { red: { left: false, right: true, jump: false }, blue: IDLE });
    const releasedX = player.x;
    advance(scene, 40);
    return player.x - releasedX;
  }
  const normalSlide = slideDistance(plainFight());
  const iceSlide = slideDistance(sceneInFightWith('slipperyFloors'));
  assert.ok(iceSlide > normalSlide * 2, `${iceSlide} should beat ${normalSlide}`);
});

test('fast crates arrive sooner', () => {
  function ticksUntilCrate(scene) {
    let ticks = 0;
    while (scene.entityGroups.get('crates').length === 0 && ticks < 1000) {
      scene.update(NO_INPUT);
      ticks++;
    }
    return ticks;
  }
  const normalWait = ticksUntilCrate(plainFight());
  const fastWait = ticksUntilCrate(sceneInFightWith('fastCrates'));
  assert.ok(fastWait <= normalWait / 2, `${fastWait} should be at most half of ${normalWait}`);
});

function keepPlayersAwayFrom(scene, x) {
  const farthestTop = [...scene.openTops].sort((first, second) => Math.abs(second.x - x) - Math.abs(first.x - x))[0];
  for (const player of scene.players) {
    player.x = farthestTop.x + 8;
    player.y = farthestTop.y - player.height;
  }
}

test('banana rain shows a marker first, then drops a banana that lands on the marked platform', () => {
  const scene = sceneInFightWith('bananaRain');
  advanceWhile(scene, () => scene.entityGroups.get('bananaDrops').length === 0);
  const [drop] = scene.entityGroups.get('bananaDrops');
  assert.ok(drop, 'a marker appears');
  keepPlayersAwayFrom(scene, drop.x);
  assert.equal(scene.entityGroups.get('bananas').length, 0, 'no banana falls while only the marker shows');

  advance(scene, BANANA_RAIN_WARNING_TICKS - 1);
  assert.equal(scene.entityGroups.get('bananas').length, 0, 'the banana waits for the whole warning');
  scene.update(NO_INPUT);
  const [banana] = scene.entityGroups.get('bananas');
  assert.ok(banana, 'the banana drops when the warning ends');
  assert.ok(banana.y < 0, 'it starts at the top of the screen');
  advance(scene, 100);
  assert.equal(banana.x, drop.x);
  assert.equal(banana.y + banana.height, drop.y + drop.height, 'it comes to rest where the marker was');
});

test('rounds without banana rain never show a marker', () => {
  const scene = plainFight();
  advance(scene, 600);
  assert.equal(scene.entityGroups.get('bananaDrops').length, 0);
});

test('the same seed and inputs give the same pick and the same state', () => {
  function run() {
    const scene = sceneAtPick(['blue', 'red']);
    advance(scene, 3, { red: { left: false, right: true, jump: false }, blue: IDLE });
    advance(scene, 1, { red: { left: false, right: true, jump: true }, blue: IDLE });
    advance(scene, ROUND_COUNTDOWN_TICKS + 400);
    return [scene.activeModifierId, findPlayer(scene, 'red').x, scene.entityGroups.get('bananaDrops').length];
  }
  assert.deepEqual(run(), run());
});
