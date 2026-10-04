import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../src/engine/config.js';
import { recordingContext, spritesFor } from './fixtures/recording-context.mjs';
import {
  isRowReachable,
  nextBestScore,
  CRUMBLE_TICKS,
  SEA_GRACE_TICKS,
  SEA_RISE_PER_TICK,
  SurvivalScene,
} from '../src/scenes/survival-scene.js';
import { heightMeterFractions, isNewBestFlashing } from '../src/ui/hud.js';

const idle = { red: { left: false, right: false, jump: false } };

// Steers under the nearest run of the next row and jumps up through it. Holds jump in the air and taps it on the ground.
function makeClimber(scene) {
  let targetRow = null;
  return (tick) => {
    const player = scene.players[0];
    const feetY = player.y + player.height;
    if (player.onGround || !targetRow) targetRow = scene.rows.find((row) => row.y < feetY - 1);
    const playerCenter = player.x + player.width / 2;
    const isAboveTarget = feetY <= targetRow.y;
    let bestOffset = Infinity;
    for (const run of targetRow.runs.filter((candidate) => !candidate.broken)) {
      const aimXs = [run.x + run.width / 2];
      for (const aimX of aimXs) {
        for (const shift of [-SCREEN_WIDTH, 0, SCREEN_WIDTH]) {
          const offset = aimX + shift - playerCenter;
          if (Math.abs(offset) < Math.abs(bestOffset)) bestOffset = offset;
        }
      }
    }
    return { red: { left: bestOffset < -4, right: bestOffset > 4, jump: !player.onGround || tick % 2 === 0 } };
  };
}

function layout(scene) {
  return scene.rows.map((row) => ({ y: row.y, runs: row.runs.map(({ crab, ...run }) => run) }));
}

test('the same seed builds the same tower', () => {
  const first = new SurvivalScene({ seed: 7 });
  const second = new SurvivalScene({ seed: 7 });
  const other = new SurvivalScene({ seed: 8 });

  assert.deepEqual(layout(first), layout(second));
  assert.notDeepEqual(layout(first), layout(other));
});

test('every row can be reached from the row below', () => {
  for (let seed = 0; seed < 50; seed++) {
    const scene = new SurvivalScene({ seed });
    const climb = makeClimber(scene);
    for (let tick = 0; tick < 600; tick++) scene.update(climb(tick));
    for (let index = 1; index < scene.rows.length; index++) {
      assert.ok(isRowReachable(scene.rows[index], scene.rows[index - 1]), `seed ${seed} row ${index}`);
    }
  }
});

test('the camera never moves down during a run', () => {
  const scene = new SurvivalScene({ seed: 3 });
  const climb = makeClimber(scene);
  let lowestSeen = scene.cameraTopY;
  let player = scene.players[0];
  for (let tick = 0; tick < 900; tick++) {
    scene.update(tick % 200 < 150 ? climb(tick) : idle);
    if (scene.players[0] !== player) {
      // A new run starts with a fresh camera.
      player = scene.players[0];
      lowestSeen = scene.cameraTopY;
    }
    assert.ok(scene.cameraTopY <= lowestSeen);
    lowestSeen = scene.cameraTopY;
  }
  assert.ok(scene.cameraTopY < 0, 'the player climbed');
});

test('rows are generated above the camera and dropped far below it', () => {
  const scene = new SurvivalScene({ seed: 5 });
  const climb = makeClimber(scene);
  for (let tick = 0; tick < 900; tick++) scene.update(climb(tick));

  assert.ok(scene.rows.at(-1).y < scene.cameraTopY - SCREEN_HEIGHT / 2, 'a screen of rows waits above');
  assert.ok(scene.rows.every((row) => row.y <= scene.cameraTopY + 2 * SCREEN_HEIGHT));
  assert.equal(
    scene.entityGroups.get('platforms').length,
    scene.rows.reduce((sum, row) => sum + row.runs.filter((run) => !run.broken).length, 0),
  );
});

function runUntilOver(scene, maxTicks = 3000) {
  for (let tick = 0; tick < maxTicks && scene.phase !== 'over'; tick++) scene.update(idle);
}

test('the sea holds still for the grace period, then rises steadily', () => {
  const scene = new SurvivalScene({ seed: 1 });
  const startSeaY = scene.seaY;
  for (let tick = 0; tick < SEA_GRACE_TICKS; tick++) scene.update({ red: { left: false, right: false, jump: false } });
  assert.equal(scene.seaY, startSeaY);

  scene.update(idle);
  scene.update(idle);
  assert.equal(scene.seaY, startSeaY - 2 * SEA_RISE_PER_TICK);
});

test('the sea ends the run once it reaches the player, and announces the score', () => {
  const scene = new SurvivalScene({ seed: 1 });
  const ended = [];
  scene.events.on('run-ended', (event) => ended.push(event));

  runUntilOver(scene);

  assert.equal(scene.phase, 'over');
  assert.deepEqual(ended, [{ score: 0 }]);
  const player = scene.players[0];
  assert.ok(player.y + player.height >= scene.seaY);
});

test('the score is the whole pixels climbed and never drops when the player falls', () => {
  const scene = new SurvivalScene({ seed: 4 });
  const climb = makeClimber(scene);
  const startY = scene.startPlayerY;
  let highestScore = 0;
  for (let tick = 0; tick < 300; tick++) {
    scene.update(climb(tick));
    assert.ok(Number.isInteger(scene.score));
    assert.ok(scene.score >= highestScore);
    highestScore = scene.score;
  }
  assert.ok(highestScore > 0);
  assert.equal(highestScore, startY - scene.lowestPlayerY);
});

test('the best score is kept from the run-ended event', () => {
  const scene = new SurvivalScene({ seed: 1 });
  scene.events.emit('run-ended', { score: 120 });
  scene.events.emit('run-ended', { score: 40 });
  assert.equal(scene.bestScore, 120);
});

test('the best score never decreases', () => {
  let best = 0;
  for (const score of [0, 50, 20, 50, 300, 299, 0]) {
    const next = nextBestScore(best, score);
    assert.ok(next >= best);
    best = next;
  }
  assert.equal(best, 300);
});

test('a fresh Enter press after the run ends starts a new run with the next seed', () => {
  const scene = new SurvivalScene({ seed: 10 });
  const firstLayout = layout(scene);
  runUntilOver(scene);
  const enter = { red: { left: false, right: false, jump: false, confirm: true } };

  scene.update(enter);
  scene.update(idle);
  assert.equal(scene.phase, 'playing');
  assert.equal(scene.seaY, scene.rows[0].y + 48);
  assert.equal(scene.score, 0);
  assert.notDeepEqual(layout(scene), firstLayout);
  assert.deepEqual(layout(scene), layout(new SurvivalScene({ seed: 11 })));
});

test('Enter held through the end of the run does not start a new one, and a fresh press does', () => {
  const scene = new SurvivalScene({ seed: 10 });
  const enter = { red: { left: false, right: false, jump: false, confirm: true } };
  scene.update(enter);
  scene.phase = 'over';

  scene.update(enter);
  assert.equal(scene.phase, 'over');
  scene.update(idle);
  scene.update(enter);
  assert.equal(scene.phase, 'playing');
});

test('the jump key does not restart from game over, and back leaves', () => {
  const titleReturns = [];
  const scene = new SurvivalScene({ seed: 10, returnToTitle: () => titleReturns.push(true) });
  scene.phase = 'over';

  scene.update({ red: { left: false, right: false, jump: true } });
  assert.equal(scene.phase, 'over');
  scene.update(idle);
  scene.update({ red: { left: false, right: false, jump: false, back: true } });
  assert.equal(titleReturns.length, 1);
});

test('the player wraps across the screen edge', () => {
  const scene = new SurvivalScene({ seed: 1 });
  const player = scene.players[0];
  player.x = -player.width - 1;

  scene.update(idle);

  assert.ok(player.x > 600);
});

test('render draws every block of every row shifted by the camera', () => {
  const stoneBlocks = new Proxy({}, { get: (_, name) => ({ name }) });
  const scene = new SurvivalScene({ seed: 2, sprites: { ...spritesFor('claude'), stoneBlocks } });
  const gameContext = recordingContext();
  const translations = [];
  gameContext.save = () => {};
  gameContext.restore = () => {};
  gameContext.translate = (x, y) => translations.push([x, y]);
  const noop = {
    updateBackground() {},
    clearGameLayer() {},
    clearUiLayer() {},
    gameContext,
    uiContext: recordingContext(),
  };
  const climb = makeClimber(scene);
  for (let tick = 0; tick < 300; tick++) scene.update(climb(tick));

  scene.render(noop);

  const blockCount = scene.rows.reduce(
    (sum, row) => sum + row.runs.reduce((runSum, run) => runSum + run.width / 16, 0),
    0,
  );
  const blockDraws = gameContext.drawnImages.filter((draw) => String(draw.image.name).startsWith('block-small'));
  assert.equal(blockDraws.length, blockCount);
  assert.deepEqual(translations, [[0, -scene.cameraTopY]]);
});

test('the sea catches up when the camera climbs far above it', () => {
  const scene = new SurvivalScene({ seed: 2 });
  scene.cameraTopY = -2000;
  scene.update(idle);
  assert.ok(scene.seaY <= scene.cameraTopY + SCREEN_HEIGHT + 48);
});

// Puts the player one tick above the top of a row's first run, falling onto it, and turns that run into the given kind.
function dropOnto(scene, kind, rowIndex = 1) {
  const row = scene.rows[rowIndex];
  const run = row.runs[0];
  run.kind = kind;
  const player = scene.players[0];
  player.x = run.x + run.width / 2 - player.width / 2;
  player.y = row.y - player.height - 1;
  player.previousY = player.y;
  player.velocityY = 2;
  player.onGround = false;
  return run;
}

function collectEvents(scene, name) {
  const events = [];
  scene.events.on(name, (event) => events.push(event));
  return events;
}

test('the start floor is stone and about a tenth of the other runs near the start are special', () => {
  const kinds = { stone: 0, ice: 0, bounce: 0, fire: 0, crumbling: 0 };
  for (let seed = 0; seed < 40; seed++) {
    const scene = new SurvivalScene({ seed });
    assert.equal(scene.rows[0].runs[0].kind, 'stone');
    for (const run of scene.rows.slice(1).flatMap((row) => row.runs)) kinds[run.kind]++;
  }
  const total = Object.values(kinds).reduce((sum, count) => sum + count, 0);
  const special = total - kinds.stone;
  assert.ok(special / total > 0.06 && special / total < 0.16);
  for (const kind of ['ice', 'bounce', 'fire', 'crumbling']) assert.ok(kinds[kind] > 0, kind);
});

test('a crumbling platform is solid for 29 ticks after landing and gone on tick 30', () => {
  const scene = new SurvivalScene({ seed: 1 });
  const run = dropOnto(scene, 'crumbling');
  const broken = collectEvents(scene, 'block-broken');
  const platforms = () => scene.entityGroups.get('platforms');

  scene.update(idle);
  assert.ok(scene.players[0].onGround, 'landed');
  for (let tick = 1; tick < CRUMBLE_TICKS; tick++) {
    scene.update(idle);
    assert.ok(platforms().includes(run.platform), 'solid on tick ' + tick);
    assert.ok(scene.players[0].onGround);
  }
  assert.equal(broken.length, 0);

  scene.update(idle);
  assert.ok(!platforms().includes(run.platform));
  assert.equal(broken.length, run.width / 16);
  assert.deepEqual(broken[0], { x: run.x, y: scene.rows[1].y, size: 16 });
});

test('a crumbling platform waits for a landing before it starts to break', () => {
  const scene = new SurvivalScene({ seed: 1 });
  const run = scene.rows[1].runs[0];
  run.kind = 'crumbling';
  for (let tick = 0; tick < 60; tick++) scene.update(idle);
  assert.ok(scene.entityGroups.get('platforms').includes(run.platform));
});

test('landing on ice slips the player the way they were moving', () => {
  const scene = new SurvivalScene({ seed: 1 });
  dropOnto(scene, 'ice');
  scene.players[0].velocityX = 2;

  scene.update(idle);
  const player = scene.players[0];

  assert.ok(player.slipTicksRemaining > 0);
  assert.equal(player.slipDirection, 1);
});

test('landing on stone does not slip', () => {
  const scene = new SurvivalScene({ seed: 1 });
  dropOnto(scene, 'stone');
  scene.update(idle);
  assert.equal(scene.players[0].slipTicksRemaining, 0);
});

test('landing on fire knocks the player up and back, and announces the burn', () => {
  const scene = new SurvivalScene({ seed: 1 });
  dropOnto(scene, 'fire');
  const player = scene.players[0];
  player.velocityX = 2;
  const burned = collectEvents(scene, 'player-burned');

  scene.update(idle);

  assert.deepEqual(burned, [{ playerId: 'red' }]);
  assert.ok(player.knockbackVelocityX < 0, 'thrown back');
  assert.ok(player.velocityY < 0, 'thrown up');
});

test('a bounce platform launches a falling player and carries a pad', () => {
  let scene;
  for (let seed = 0; !scene; seed++) {
    const candidate = new SurvivalScene({ seed });
    if (candidate.rows.slice(1).some((row) => row.runs.some((run) => run.kind === 'bounce'))) scene = candidate;
  }
  const row = scene.rows.slice(1).find((candidate) => candidate.runs.some((run) => run.kind === 'bounce'));
  const run = row.runs.find((candidate) => candidate.kind === 'bounce');
  assert.equal(run.pad.y + run.pad.height, row.y);
  const player = scene.players[0];
  player.x = run.pad.x + 6;
  player.y = run.pad.y - player.height - 1;
  player.previousY = player.y;
  player.velocityY = 4;

  scene.update(idle);
  scene.update(idle);

  assert.ok(player.velocityY < -10.4, 'launched harder than a jump');
});

test('the burn rattles the eyes and throws sparks', () => {
  const scene = new SurvivalScene({ seed: 1 });
  dropOnto(scene, 'fire');
  scene.update(idle);
  assert.ok(scene.particles.list.length > 0);
  assert.ok(scene.playerEyes.eyesFor('red').some((eye) => eye.offsetX !== 0 || eye.offsetY !== 0));
});

test('the same seed and inputs give the same special platforms and player path', () => {
  const runOnce = () => {
    const scene = new SurvivalScene({ seed: 9 });
    const climb = makeClimber(scene);
    for (let tick = 0; tick < 600; tick++) scene.update(climb(tick));
    return {
      kinds: scene.rows.flatMap((row) => row.runs.map((run) => run.kind + (run.broken ? 'x' : ''))),
      x: scene.players[0].x,
      y: scene.players[0].y,
    };
  };
  assert.deepEqual(runOnce(), runOnce());
});

test('every row keeps a run within reach that is not fire', () => {
  for (let seed = 0; seed < 40; seed++) {
    const scene = new SurvivalScene({ seed });
    for (let index = 1; index < scene.rows.length; index++) {
      const safeRuns = scene.rows[index].runs.filter((run) => run.kind !== 'fire');
      assert.ok(isRowReachable({ runs: safeRuns }, scene.rows[index - 1]), `seed ${seed} row ${index}`);
    }
  }
});

test('the meter fills against the best and puts the marker at the best', () => {
  assert.deepEqual(heightMeterFractions(50, 200), { fill: 0.25, marker: 1 });
  assert.deepEqual(heightMeterFractions(300, 200), { fill: 1, marker: 2 / 3 });
  assert.deepEqual(heightMeterFractions(0, 0), { fill: 0, marker: null });
  assert.deepEqual(heightMeterFractions(40, 0), { fill: 1, marker: null });
});

test('beating the best emits new-best once, and never on a first run', () => {
  const beaten = new SurvivalScene({ seed: 1 });
  beaten.bestScore = 20;
  const scores = [];
  beaten.events.on('new-best', ({ score }) => scores.push(score));
  const climb = makeClimber(beaten);
  for (let tick = 0; tick < 400 && beaten.phase === 'playing'; tick++) beaten.update(climb(tick));
  assert.equal(scores.length, 1);
  assert.ok(scores[0] > 20);
  assert.ok(isNewBestFlashing(beaten) || beaten.runTicks - beaten.newBestTick >= 120);

  const firstRun = new SurvivalScene({ seed: 1 });
  firstRun.bestScore = 0;
  firstRun.events.on('new-best', () => assert.fail('a first run has no best to beat'));
  const firstClimb = makeClimber(firstRun);
  for (let tick = 0; tick < 200 && firstRun.phase === 'playing'; tick++) firstRun.update(firstClimb(tick));
});
