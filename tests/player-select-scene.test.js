import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHARACTERS } from '../src/entities/characters.js';
import { PlayerSelectScene, playerCardBox, START_COUNTDOWN_TICKS } from '../src/scenes/player-select-scene.js';
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

test('each fresh jump press moves a player from joining to picking to ready', () => {
  const { scene } = sceneWithBaseline();

  scene.update(inputsWithJump('red'));
  assert.equal(scene.stateByPlayerId.red, 'picking');

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

test('the mode choice does not open until both players are ready', () => {
  const { scene, scenes } = sceneWithBaseline();

  readyUp(scene, 'red');
  assert.equal(scene.stateByPlayerId.red, 'ready');
  runCountdown(scene);
  assert.equal(scenes.length, 0, 'only one player is ready so far');

  readyUp(scene, 'blue');
  assert.equal(scene.stateByPlayerId.blue, 'ready');
  assert.equal(scenes.length, 0, 'the countdown has only just begun');
  runCountdown(scene);

  assert.equal(scenes.length, 1, 'the mode choice opens once every player is ready');
  assert.equal(scenes[0].constructor.name, 'ModeSelectScene');
});

function press(scene, playerId, button) {
  scene.update({ ...neutralInputs(), [playerId]: { ...noInput(), [button]: true } });
  scene.update(neutralInputs());
}

function readyUp(scene, playerId) {
  press(scene, playerId, 'jump');
  press(scene, playerId, 'jump');
}

function runCountdown(scene, ticks = START_COUNTDOWN_TICKS) {
  for (let tick = 0; tick < ticks; tick++) scene.update(neutralInputs());
}

test('left and right do nothing once a player is ready', () => {
  const { scene } = sceneWithBaseline();
  press(scene, 'red', 'jump');
  press(scene, 'red', 'jump');

  press(scene, 'red', 'right');

  assert.equal(hoveredCharacterName(scene, 'red'), 'claude');
});

function hoveredCharacterName(scene, playerId) {
  return CHARACTERS[scene.characterIndexByPlayerId[playerId]].name;
}

test('red starts hovering on Claude and blue on Meta AI', () => {
  const { scene } = sceneWithBaseline();

  assert.equal(hoveredCharacterName(scene, 'red'), 'claude');
  assert.equal(hoveredCharacterName(scene, 'blue'), 'meta');
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

  assert.equal(scene.stateByPlayerId.red, 'ready');
  assert.equal(hoveredCharacterName(scene, 'blue'), CHARACTERS.at(-1).name, 'Claude is locked, so blue steps past it');
});

test('a player hovering on a character the other player locks in moves to the next free one', () => {
  const { scene } = sceneWithBaseline();
  press(scene, 'blue', 'jump');
  press(scene, 'red', 'jump');
  press(scene, 'red', 'right');
  assert.equal(hoveredCharacterName(scene, 'blue'), 'meta', 'hovering is not locking, so red may hover on Meta AI too');

  press(scene, 'red', 'jump');

  assert.equal(hoveredCharacterName(scene, 'red'), 'meta');
  assert.equal(hoveredCharacterName(scene, 'blue'), 'chatgpt');
  assert.equal(scene.stateByPlayerId.blue, 'picking');
});

test('level select gets the character each player locked in', () => {
  const { scene, scenes } = sceneWithBaseline();
  press(scene, 'blue', 'jump');
  press(scene, 'red', 'jump');
  press(scene, 'red', 'right');
  press(scene, 'red', 'jump');
  press(scene, 'blue', 'jump');
  runCountdown(scene);

  const { characterByPlayerId } = scenes[0];
  assert.deepEqual([characterByPlayerId.red.name, characterByPlayerId.blue.name], ['meta', 'chatgpt']);
});

test('changing character starts a hop, joining slides the card in instead', () => {
  const { scene } = sceneWithBaseline();
  const cardBox = playerCardBox(0);

  scene.update(inputsWithJump('red'));
  assert.equal(scene.cardMotion.pose(0).offsetY, 0);
  assert.ok(scene.cardMotion.slideOffsetX(0, cardBox) < 0);

  scene.update({ ...neutralInputs(), red: { ...noInput(), right: true } });
  for (let tick = 0; tick < 8; tick++) scene.update(neutralInputs());
  assert.ok(scene.cardMotion.pose(0).offsetY > 0);
});

test('locking in emits a cheer for the chosen character and starts the cheer pose', () => {
  const { scene } = sceneWithBaseline();
  const cheers = [];
  scene.events.on('character-cheered', (data) => cheers.push(data));

  press(scene, 'red', 'jump');
  press(scene, 'red', 'jump');

  assert.deepEqual(cheers, [{ playerId: 'red', characterName: 'claude' }]);
  for (let tick = 0; tick < 12; tick++) scene.update(neutralInputs());
  assert.ok(scene.cardMotion.pose(0).offsetY > 0);
});

function lockIn(scene, playerId) {
  press(scene, playerId, 'jump');
  press(scene, playerId, 'jump');
}

test('the green and yellow seats join and pick like the others', () => {
  const { scene } = sceneWithBaseline();

  press(scene, 'green', 'jump');
  press(scene, 'yellow', 'jump');
  press(scene, 'green', 'right');

  assert.equal(scene.stateByPlayerId.green, 'picking');
  assert.equal(scene.stateByPlayerId.yellow, 'picking');
  assert.equal(hoveredCharacterName(scene, 'green'), 'gemini', 'ChatGPT was the starting pick, so right is Gemini');
  assert.equal(scene.stateByPlayerId.red, 'unjoined');
});

test('a match needs two ready players, so one alone never starts it', () => {
  const { scene, scenes } = sceneWithBaseline();

  lockIn(scene, 'green');
  runCountdown(scene);

  assert.equal(scene.stateByPlayerId.green, 'ready');
  assert.equal(scenes.length, 0);
});

test('the match starts with exactly the players who are ready, in seat order', () => {
  const { scene, scenes } = sceneWithBaseline();

  lockIn(scene, 'yellow');
  readyUp(scene, 'red');
  runCountdown(scene);

  assert.equal(scenes.length, 1);
  assert.deepEqual(Object.keys(scenes[0].characterByPlayerId), ['red', 'yellow']);
});

test('a joined player who is still picking holds the match until they are ready', () => {
  const { scene, scenes } = sceneWithBaseline();
  press(scene, 'green', 'jump');
  lockIn(scene, 'red');
  lockIn(scene, 'blue');

  runCountdown(scene);
  assert.equal(scenes.length, 0, 'green joined but has not locked in');

  press(scene, 'green', 'jump');
  runCountdown(scene);
  assert.equal(scenes.length, 1);
  assert.deepEqual(Object.keys(scenes[0].characterByPlayerId), ['red', 'blue', 'green']);
});

test('all four players can join first and then be ready together', () => {
  const { scene, scenes } = sceneWithBaseline();
  for (const playerId of ['red', 'blue', 'green', 'yellow']) press(scene, playerId, 'jump');
  for (const playerId of ['red', 'blue', 'green']) press(scene, playerId, 'jump');
  runCountdown(scene);
  assert.equal(scenes.length, 0, 'yellow is still picking');

  press(scene, 'yellow', 'jump');
  runCountdown(scene);

  assert.deepEqual(Object.keys(scenes[0].characterByPlayerId), ['red', 'blue', 'green', 'yellow']);
});

test('down steps a picking player back out, so a mistaken join does not hold the match', () => {
  const { scene, scenes } = sceneWithBaseline();
  press(scene, 'green', 'jump');
  lockIn(scene, 'red');
  lockIn(scene, 'blue');
  runCountdown(scene);
  assert.equal(scenes.length, 0);

  press(scene, 'green', 'down');
  runCountdown(scene);

  assert.equal(scene.stateByPlayerId.green, 'unjoined');
  assert.equal(scenes.length, 1);
  assert.deepEqual(Object.keys(scenes[0].characterByPlayerId), ['red', 'blue']);
});

test('down does nothing to a player who has not joined', () => {
  const { scene } = sceneWithBaseline();

  press(scene, 'blue', 'down');

  assert.equal(scene.stateByPlayerId.blue, 'unjoined');
});

test('the match waits a short countdown after everyone is ready, then starts', () => {
  const { scene, scenes } = sceneWithBaseline();
  lockIn(scene, 'red');
  lockIn(scene, 'blue');

  runCountdown(scene, START_COUNTDOWN_TICKS - 20);
  assert.equal(scenes.length, 0);
  assert.ok(START_COUNTDOWN_TICKS >= 90 && START_COUNTDOWN_TICKS <= 150, 'about 2 seconds');

  runCountdown(scene, 20 + 1);
  assert.equal(scenes.length, 1);
});

test('a player who joins during the countdown holds it and is in the match', () => {
  const { scene, scenes } = sceneWithBaseline();
  lockIn(scene, 'red');
  lockIn(scene, 'blue');
  runCountdown(scene, START_COUNTDOWN_TICKS - 30);

  press(scene, 'green', 'jump');
  runCountdown(scene);
  assert.equal(scenes.length, 0, 'joining cancels the countdown until green is ready');
  assert.equal(scene.countdownTicksRemaining, null);

  press(scene, 'green', 'jump');
  runCountdown(scene);

  assert.deepEqual(Object.keys(scenes[0].characterByPlayerId), ['red', 'blue', 'green']);
});

test('a ready player who steps back cancels the countdown, and it restarts in full', () => {
  const { scene, scenes } = sceneWithBaseline();
  lockIn(scene, 'red');
  lockIn(scene, 'blue');
  runCountdown(scene, START_COUNTDOWN_TICKS - 5);

  press(scene, 'blue', 'down');
  assert.equal(scene.stateByPlayerId.blue, 'picking');
  runCountdown(scene);
  assert.equal(scenes.length, 0);

  press(scene, 'blue', 'jump');
  runCountdown(scene, START_COUNTDOWN_TICKS - 5);
  assert.equal(scenes.length, 0, 'the countdown began again from the start');
  runCountdown(scene, 10);
  assert.equal(scenes.length, 1);
});

test('the four cards sit side by side inside the screen without overlapping', () => {
  const boxes = [0, 1, 2, 3].map((seatIndex) => playerCardBox(seatIndex));

  boxes.forEach((box, index) => {
    for (const value of Object.values(box)) assert.ok(Number.isInteger(value));
    assert.ok(box.x >= 0 && box.x + box.width <= 640);
    if (index > 0) assert.ok(box.x >= boxes[index - 1].x + boxes[index - 1].width);
  });
});

test('a tap on the first card joins, a tap on its arrows changes character and a tap in the middle locks in', () => {
  const { scene } = sceneWithBaseline();
  const box = playerCardBox(0);
  const tapAt = (x) => ({ ...neutralInputs(), red: { ...noInput(), tap: { x, y: box.y + box.height / 2 } } });
  const middleX = box.x + box.width / 2;
  const startIndex = scene.characterIndexByPlayerId.red;

  scene.update(tapAt(middleX));
  assert.equal(scene.stateByPlayerId.red, 'picking');

  scene.update(tapAt(box.x + box.width - 2));
  assert.equal(scene.characterIndexByPlayerId.red, (startIndex + 1) % CHARACTERS.length);
  scene.update(tapAt(box.x + 2));
  scene.update(tapAt(box.x + 2));
  assert.equal(scene.characterIndexByPlayerId.red, (startIndex - 1 + CHARACTERS.length) % CHARACTERS.length);
  assert.equal(scene.stateByPlayerId.red, 'picking');

  scene.update(tapAt(middleX));
  assert.equal(scene.stateByPlayerId.red, 'ready');
});

test('two players on one phone each join and lock in by tapping their own card', () => {
  const { scene } = sceneWithBaseline();
  const tapCard = (seatIndex) => {
    const box = playerCardBox(seatIndex);
    scene.update({ ...neutralInputs(), red: { ...noInput(), tap: { x: box.x + box.width / 2, y: box.y + 20 } } });
  };

  tapCard(0);
  tapCard(1);
  assert.equal(scene.stateByPlayerId.red, 'picking');
  assert.equal(scene.stateByPlayerId.blue, 'picking');
  tapCard(1);
  tapCard(0);
  assert.equal(scene.stateByPlayerId.red, 'ready');
  assert.equal(scene.stateByPlayerId.blue, 'ready');
});
