import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROUND_COUNTDOWN_BEAT_TICKS, ROUND_COUNTDOWN_TICKS, ROUND_GO_TICKS, TICK_RATE } from '../src/engine/config.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { pickCallout } from '../src/ui/callouts.js';
import { isMatchPoint, roundIntroDisplay } from '../src/ui/round-intro.js';
import { harborLevel } from './fixtures/harbor-level.mjs';

function idle() {
  return { red: { left: false, right: false, jump: false }, blue: { left: false, right: false, jump: false } };
}

function advance(scene, tickCount) {
  for (let tick = 0; tick < tickCount; tick++) scene.update(idle());
}

function player(scene, id) {
  return scene.players.find((candidate) => candidate.id === id);
}

function fightingScene() {
  const scene = new VersusScene({ level: harborLevel, seed: 1 });
  advance(scene, ROUND_COUNTDOWN_TICKS);
  return scene;
}

function collectFalls(scene) {
  const falls = [];
  scene.events.on('player-fell-in-water', (fall) => falls.push(fall));
  return falls;
}

test('the intro lasts under two seconds', () => {
  assert.ok(ROUND_COUNTDOWN_TICKS + ROUND_GO_TICKS < 2 * TICK_RATE);
});

test('a round counts 3, 2, 1 with one event per beat, then GO', () => {
  const beats = [];
  const scene = new VersusScene({ level: harborLevel, seed: 1 });
  scene.events.on('countdown-beat', ({ count }) => beats.push(count));
  scene.startRound();
  assert.deepEqual(beats, [3]);
  advance(scene, ROUND_COUNTDOWN_TICKS);

  assert.deepEqual(beats, [3, 2, 1, 0]);
  assert.equal(scene.phase, 'fight');
});

test('the countdown shows each number for a whole beat, then GO!', () => {
  const scene = new VersusScene({ level: harborLevel, seed: 1 });
  const shown = [];
  for (let tick = 0; tick < ROUND_COUNTDOWN_TICKS; tick++) {
    shown.push(roundIntroDisplay(scene).text);
    advance(scene, 1);
  }
  const expected = [3, 2, 1].flatMap((count) => Array(ROUND_COUNTDOWN_BEAT_TICKS).fill(String(count)));
  assert.deepEqual(shown, expected);
  assert.equal(roundIntroDisplay(scene).text, 'GO!');
  advance(scene, ROUND_GO_TICKS);
  assert.equal(roundIntroDisplay(scene), null);
});

test('nobody can move during the countdown', () => {
  const scene = new VersusScene({ level: harborLevel, seed: 1 });
  const startX = player(scene, 'red').x;
  for (let tick = 0; tick < ROUND_COUNTDOWN_TICKS; tick++) {
    scene.update({ ...idle(), red: { left: false, right: true, jump: false } });
  }
  assert.equal(player(scene, 'red').x, startX);
});

test('a clutch beats the cause, a cause beats a plain splash', () => {
  assert.equal(pickCallout({ cause: null, secondsRemaining: 20 }), 'Splash!');
  assert.equal(pickCallout({ cause: 'rocket', secondsRemaining: 20 }), 'Sniped!');
  assert.equal(pickCallout({ cause: 'banana', secondsRemaining: 20 }), 'Slipped!');
  assert.equal(pickCallout({ cause: 'rocket', secondsRemaining: 2.5 }), 'Clutch!');
  assert.equal(pickCallout({ cause: null, secondsRemaining: 0.5 }), 'Clutch!');
  assert.equal(pickCallout({ cause: null, secondsRemaining: 3 }), 'Splash!');
  assert.equal(pickCallout({ cause: null, secondsRemaining: null }), 'Splash!');
});

test('a knockout reports its cause and the time left', () => {
  const scene = fightingScene();
  const falls = collectFalls(scene);
  player(scene, 'blue').y = 600;
  advance(scene, 1);

  assert.equal(falls[0].cause, null);
  assert.equal(falls[0].secondsRemaining, (1800 - scene.fightTicks) / TICK_RATE);
});

test('a fall soon after a banana slip is named a banana knockout', () => {
  const scene = fightingScene();
  const falls = collectFalls(scene);
  scene.recordCause('blue', 'banana');
  player(scene, 'blue').y = 600;
  advance(scene, 1);

  assert.equal(falls[0].cause, 'banana');
});

test('an old rocket hit no longer counts as the cause', () => {
  const scene = fightingScene();
  const falls = collectFalls(scene);
  scene.recordCause('blue', 'rocket');
  advance(scene, 100);
  player(scene, 'blue').y = 600;
  advance(scene, 1);

  assert.equal(falls[0].cause, null);
});

test('the callout names the knockout, and the next knockout replaces it', () => {
  const scene = fightingScene();
  scene.recordCause('blue', 'rocket');
  player(scene, 'blue').y = 600;
  advance(scene, 1);
  assert.equal(scene.callouts.current.text, 'Sniped!');

  scene.events.emit('player-fell-in-water', { playerId: 'red', cause: 'banana', secondsRemaining: 50 });
  assert.equal(scene.callouts.current.text, 'Slipped!');
});

test('match point shows when a player is one win from the match', () => {
  assert.equal(isMatchPoint({ red: 4, blue: 2 }, 5), true);
  assert.equal(isMatchPoint({ red: 3, blue: 3 }, 5), false);
  assert.equal(isMatchPoint({ red: 0, blue: 0 }, 5), false);
  assert.equal(isMatchPoint({ red: 2, blue: 4, green: 0 }, 5), true);
});
