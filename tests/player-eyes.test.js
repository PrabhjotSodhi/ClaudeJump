import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from '../src/engine/events.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { PlayerEyes } from '../src/vfx/player-eyes.js';
import { harborLevel } from './fixtures/harbor-level.mjs';

function setup() {
  const events = new EventEmitter();
  const players = [
    { id: 'red', velocityX: 0, velocityY: 0, knockbackVelocityX: 5 },
    { id: 'blue', velocityX: 0, velocityY: 0, knockbackVelocityX: 0 },
  ];
  const playerEyes = new PlayerEyes();
  playerEyes.attach(events, () => players);
  return { events, players, playerEyes };
}

function settle(playerEyes, tickCount = 1) {
  for (let tick = 0; tick < tickCount; tick++) playerEyes.update();
}

function pupilOffsets(playerEyes, playerId) {
  return playerEyes.eyesFor(playerId).map((eye) => ({ x: eye.offsetX, y: eye.offsetY }));
}

test('a jump sends the pupils of the player who jumped up', () => {
  const { events, playerEyes } = setup();

  events.emit('player-jumped', { playerId: 'red', x: 0, y: 0 });
  settle(playerEyes);

  assert.ok(pupilOffsets(playerEyes, 'red').every(({ y }) => y < 0));
  assert.deepEqual(pupilOffsets(playerEyes, 'blue'), [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]);
});

test('shoves, dash hits and blasts rattle the pupils of the players they hit, and nobody else', () => {
  const hits = [
    ['player-shoved', { shoverId: 'blue', targetId: 'red' }],
    ['dash-hit', { playerIds: ['red'] }],
    ['rocket-exploded', { x: 0, y: 0, playerIds: ['red'] }],
    ['bomb-exploded', { x: 0, y: 0, playerIds: ['red'] }],
  ];
  for (const [eventName, eventData] of hits) {
    const { events, playerEyes } = setup();
    const untouched = setup();

    events.emit(eventName, eventData);
    settle(playerEyes);
    settle(untouched.playerEyes);

    const hitOffsets = pupilOffsets(playerEyes, 'red');
    const untouchedOffsets = pupilOffsets(untouched.playerEyes, 'red');
    hitOffsets.forEach(({ x }, index) => {
      assert.ok(x < untouchedOffsets[index].x, `${eventName}: the pupils are left behind a body pushed to the right`);
    });
    assert.deepEqual(pupilOffsets(playerEyes, 'blue'), pupilOffsets(untouched.playerEyes, 'blue'));
  }
});

test('the pupils lag behind a moving player', () => {
  const { players, playerEyes } = setup();
  players[0].knockbackVelocityX = 0;
  players[0].velocityX = 3;

  settle(playerEyes, 30);

  assert.ok(pupilOffsets(playerEyes, 'red').every(({ x }) => x < 0));
});

test('a versus match wires its events and players into the eyes', () => {
  const scene = new VersusScene({ level: harborLevel, startInFightPhase: true, seed: 0 });
  const [red, blue] = scene.players;

  scene.events.emit('player-jumped', { playerId: red.id, x: 0, y: 0 });
  scene.update({});

  const [redEye] = scene.playerEyes.eyesFor(red.id);
  const [blueEye] = scene.playerEyes.eyesFor(blue.id);
  assert.ok(redEye.offsetY < blueEye.offsetY, 'only the player who jumped has the pupils thrown upward');
});
