import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  STEAM_VENT_BLAST_TICKS,
  STEAM_VENT_LAUNCH_VELOCITY,
  STEAM_VENT_WARNING_TICKS,
  TICK_RATE,
} from '../src/engine/config.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { arenaLevels } from './fixtures/arena-levels.mjs';

const IDLE = { left: false, right: false, jump: false };
const NO_INPUT = { red: IDLE, blue: IDLE };
const TOWER_TOP_Y = 160;
const LEFT_TOWER_X = 192;

function towersFight() {
  return new VersusScene({ level: arenaLevels['cooling-towers'], startInFightPhase: true, seed: 1 });
}

function vents(scene) {
  return scene.entityGroups.get('hazards');
}

function leftVent(scene) {
  return vents(scene).find((vent) => vent.x + vent.width / 2 === LEFT_TOWER_X);
}

function player(scene, id) {
  return scene.players.find((candidate) => candidate.id === id);
}

function standOnTower(target, x = LEFT_TOWER_X) {
  target.x = x - target.width / 2;
  target.y = TOWER_TOP_Y - target.height;
  target.velocityY = 0;
}

function advanceUntil(scene, condition, limit = 2000) {
  for (let tick = 0; tick < limit && !condition(); tick++) scene.update(NO_INPUT);
  assert.ok(condition(), 'the condition was never reached');
}

test('Cooling Towers has a vent on each tower top and other arenas have none', () => {
  assert.equal(vents(towersFight()).length, 2);
  const harbor = new VersusScene({ level: arenaLevels.harbor, startInFightPhase: true, seed: 1 });
  assert.ok(harbor.entityGroups.get('hazards').every((hazard) => hazard.constructor.name !== 'SteamVent'));
  const cave = new VersusScene({ level: arenaLevels.cave, startInFightPhase: true, seed: 1 });
  assert.equal(cave.entityGroups.get('hazards').length, 0);
});

test('a player standing in the blast is launched far above the tower', () => {
  const scene = towersFight();
  const red = player(scene, 'red');
  advanceUntil(scene, () => {
    if (leftVent(scene).phase !== 'blasting') standOnTower(red);
    scene.update(NO_INPUT);
    return leftVent(scene).phase === 'blasting';
  });
  let highestY = red.y;
  for (let tick = 0; tick < 60; tick++) {
    scene.update(NO_INPUT);
    highestY = Math.min(highestY, red.y);
  }
  const risen = TOWER_TOP_Y - red.height - highestY;
  assert.ok(risen > 110, `red rose ${risen} pixels, more than a jump's 90`);
});

test('a player beside the blast is not launched', () => {
  const scene = towersFight();
  const blue = player(scene, 'blue');
  let blastTicks = 0;
  for (let tick = 0; tick < 400; tick++) {
    standOnTower(blue, LEFT_TOWER_X + 60);
    scene.update(NO_INPUT);
    if (leftVent(scene).phase === 'blasting') {
      blastTicks++;
      assert.ok(blue.velocityY >= 0, 'blue was left alone');
    }
  }
  assert.ok(blastTicks > 0);
});

test('every vent hisses for a full second before each blast and launches nobody while it does', () => {
  const scene = towersFight();
  const red = player(scene, 'red');
  const warningTicksByVent = new Map();
  let blastsSeen = 0;
  for (let tick = 0; tick < 1000; tick++) {
    standOnTower(red);
    red.x = leftVent(scene).x + 4;
    for (const vent of vents(scene)) {
      if (vent.phase === 'warning') warningTicksByVent.set(vent, (warningTicksByVent.get(vent) ?? 0) + 1);
    }
    const before = vents(scene).map((vent) => vent.phase);
    scene.update(NO_INPUT);
    vents(scene).forEach((vent, index) => {
      if (vent.phase === 'blasting' && before[index] !== 'blasting') {
        blastsSeen++;
        assert.equal(warningTicksByVent.get(vent), TICK_RATE, 'a full second of warning came first');
        warningTicksByVent.set(vent, 0);
      }
    });
    if (leftVent(scene).phase === 'warning') {
      assert.ok(red.velocityY >= 0, 'nobody is launched during the warning');
    }
  }
  assert.ok(blastsSeen >= 6, `${blastsSeen} blasts`);
});

test('one blast launches a player once, however long they stay in it', () => {
  const scene = towersFight();
  const red = player(scene, 'red');
  advanceUntil(scene, () => leftVent(scene).phase === 'warning');
  let launches = 0;
  for (let tick = 0; tick < STEAM_VENT_WARNING_TICKS + STEAM_VENT_BLAST_TICKS; tick++) {
    standOnTower(red);
    scene.update(NO_INPUT);
    if (red.velocityY === STEAM_VENT_LAUNCH_VELOCITY) launches++;
  }
  assert.equal(launches, 1);
});

test('the two vents do not blast on the same ticks', () => {
  const scene = towersFight();
  let blastingTogether = 0;
  for (let tick = 0; tick < 1200; tick++) {
    scene.update(NO_INPUT);
    if (vents(scene).every((vent) => vent.phase === 'blasting')) blastingTogether++;
  }
  assert.equal(blastingTogether, 0);
});
