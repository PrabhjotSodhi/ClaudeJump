import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from '../src/engine/events.js';
import { SEA_COLUMN_COUNT } from '../src/engine/config.js';
import { Particles } from '../src/vfx/particles.js';
import { SeaRipple } from '../src/vfx/sea-ripple.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { harborLevel } from './fixtures/harbor-level.mjs';

const PLAYERS = [
  { id: 'red', color: '#dc2828', x: 100, y: 200 },
  { id: 'blue', color: '#2864dc', x: 140, y: 200 },
];

function setUp(tickCount = 0) {
  const events = new EventEmitter();
  const particles = new Particles();
  particles.attach(events, { getPlayers: () => PLAYERS, getWaterLineY: () => 330, getTickCount: () => tickCount });
  return { events, particles };
}

test('jumps and landings kick up pale grey dust', () => {
  const { events, particles } = setUp();
  events.emit('player-jumped', { playerId: 'red', x: 112, y: 228 });
  events.emit('player-landed', { playerId: 'red', x: 112, y: 228 });
  assert.ok(particles.list.length > 0);
  assert.ok(particles.list.every((particle) => particle.color === '#c8ccd4'));
});

test('shoves and card plays throw sparks in the hitting player color', () => {
  const { events, particles } = setUp();
  events.emit('player-shoved', { shoverId: 'blue', targetId: 'red' });
  events.emit('card-played', { playerId: 'red', cardName: 'dash' });
  assert.equal(particles.list.length, 16, 'two events, eight sparks each');
  const colors = new Set(particles.list.map((particle) => particle.color));
  assert.deepEqual([...colors].sort(), ['#2864dc', '#dc2828']);
});

test('a dash hit throws sparks in both players colors, and blasts throw sparks', () => {
  const { events, particles } = setUp();
  events.emit('dash-hit', { playerIds: ['red', 'blue'] });
  assert.deepEqual([...new Set(particles.list.map((particle) => particle.color))].sort(), ['#2864dc', '#dc2828']);
  particles.list = [];
  events.emit('rocket-exploded', { x: 50, y: 50 });
  events.emit('bomb-exploded', { x: 60, y: 60 });
  assert.ok(particles.list.length > 0);
});

test('the same events throw the same particles and they die out', () => {
  const run = () => {
    const { events, particles } = setUp(7);
    events.emit('rocket-exploded', { x: 50, y: 50 });
    events.emit('player-jumped', { playerId: 'red', x: 112, y: 228 });
    for (let tick = 0; tick < 5; tick++) particles.update();
    return JSON.stringify(particles.list);
  };
  assert.equal(run(), run());
  const { events, particles } = setUp();
  events.emit('rocket-exploded', { x: 50, y: 50 });
  for (let tick = 0; tick < 60; tick++) particles.update();
  assert.equal(particles.list.length, 0);
});

test('a player falling in throws droplets at the sea surface', () => {
  const { events, particles } = setUp();
  events.emit('player-fell-in-water', { playerId: 'red' });
  assert.ok(particles.list.length > 0);
  assert.ok(particles.list.every((particle) => particle.y === 330 && particle.velocityY < 0));
});

test('the ripple starts at the splash column and settles back to flat', () => {
  const ripple = new SeaRipple();
  ripple.splash(320);
  ripple.update();
  const column = SEA_COLUMN_COUNT / 2;
  assert.ok(Math.abs(ripple.heights[column]) > 1);
  assert.equal(ripple.heights[0], 0, 'far columns have not moved yet');
  let farColumnMoved = false;
  for (let tick = 0; tick < 400 && !farColumnMoved; tick++) {
    ripple.update();
    farColumnMoved = ripple.heights[0] !== 0;
  }
  assert.ok(farColumnMoved, 'the wave reaches the edge of the sea');
  for (let tick = 0; tick < 3000; tick++) ripple.update();
  assert.ok(ripple.heights.every((height) => height === 0));
  assert.ok(ripple.toBytes().every((value, index) => value === (index % 4 === 3 ? 255 : 128)));
});

test('a player falling in makes the scene ripple, and effects never change players', () => {
  const inputs = { red: { left: false, right: false, jump: false }, blue: { left: false, right: false, jump: false } };
  const withEffects = new VersusScene({ level: harborLevel, startInFightPhase: true, seed: 0 });
  const fallingRed = withEffects.players.find((player) => player.id === 'red');
  fallingRed.y = withEffects.waterLineY;
  withEffects.update(inputs);
  assert.ok(
    withEffects.seaRipple.heights.some((height) => height !== 0) ||
      withEffects.seaRipple.speeds.some((speed) => speed !== 0),
  );
  assert.ok(withEffects.particles.list.length > 0);

  const without = new VersusScene({ level: harborLevel, startInFightPhase: true, seed: 0 });
  without.players.find((player) => player.id === 'red').y = without.waterLineY;
  without.particles.attach = () => {};
  without.particles.update = () => {};
  without.seaRipple.update = () => {};
  without.update(inputs);
  for (let tick = 0; tick < 30; tick++) {
    withEffects.update(inputs);
    without.update(inputs);
  }
  const positions = (scene) => scene.players.map((player) => [player.x, player.y]);
  assert.deepEqual(positions(withEffects), positions(without));
});

test('a jump and a hard landing emit events, a soft landing does not', () => {
  const scene = new VersusScene({ level: harborLevel, startInFightPhase: true, seed: 0 });
  const seen = [];
  scene.events.on('player-jumped', ({ playerId }) => seen.push(`jump-${playerId}`));
  scene.events.on('player-landed', ({ playerId }) => seen.push(`land-${playerId}`));
  const idle = { left: false, right: false, jump: false };
  for (let tick = 0; tick < 90; tick++) scene.update({ red: idle, blue: idle });
  assert.deepEqual(seen, [], 'settling onto the start platform is a soft landing');
  scene.update({ red: { ...idle, jump: true }, blue: idle });
  assert.deepEqual(seen, ['jump-red']);
});

test('a long fall onto a platform emits a hard landing', () => {
  const scene = new VersusScene({ level: harborLevel, startInFightPhase: true, seed: 0 });
  const landed = [];
  scene.events.on('player-landed', ({ playerId }) => landed.push(playerId));
  const idle = { left: false, right: false, jump: false };
  const red = scene.players.find((player) => player.id === 'red');
  red.y = 0;
  for (let tick = 0; tick < 120; tick++) scene.update({ red: idle, blue: idle });
  assert.deepEqual(landed, ['red']);
});
