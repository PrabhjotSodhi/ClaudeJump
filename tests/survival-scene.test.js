import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../src/engine/config.js';
import { recordingContext, spritesFor } from './fixtures/recording-context.mjs';
import {
  isRowReachable,
  nextBestScore,
  SEA_GRACE_TICKS,
  SEA_RISE_PER_TICK,
  SurvivalScene,
} from '../src/scenes/survival-scene.js';

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
    for (const run of targetRow.runs) {
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
  return scene.rows.map((row) => ({ y: row.y, runs: row.runs }));
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
    scene.rows.reduce((sum, row) => sum + row.runs.length, 0),
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

test('a fresh jump press after the run ends starts a new run with the next seed', () => {
  const scene = new SurvivalScene({ seed: 10 });
  const firstLayout = layout(scene);
  runUntilOver(scene);
  const jump = { red: { left: false, right: false, jump: true } };

  scene.update(jump);
  scene.update(idle);
  assert.equal(scene.phase, 'playing');
  assert.equal(scene.seaY, scene.rows[0].y + 48);
  assert.equal(scene.score, 0);
  assert.notDeepEqual(layout(scene), firstLayout);
  assert.deepEqual(layout(scene), layout(new SurvivalScene({ seed: 11 })));
});

test('a jump held through the end of the run does not start a new one', () => {
  const scene = new SurvivalScene({ seed: 10 });
  const jump = { red: { left: false, right: false, jump: true } };
  scene.jumpHeld = true;
  scene.phase = 'over';

  scene.update(jump);
  assert.equal(scene.phase, 'over');
  scene.update(idle);
  scene.update(jump);
  assert.equal(scene.phase, 'playing');
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
