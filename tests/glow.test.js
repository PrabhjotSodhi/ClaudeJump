import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from '../src/engine/events.js';
import { Rocket } from '../src/entities/rocket.js';
import { Particles } from '../src/vfx/particles.js';
import { drawParticles } from '../src/vfx/particles.js';

function recordingContext() {
  const fills = [];
  return { fills, fillStyle: '', fillRect: (...area) => fills.push(area) };
}

function sceneWith(eventName, details) {
  const events = new EventEmitter();
  const particles = new Particles();
  particles.attach(events, { getPlayers: () => [] });
  events.emit(eventName, details);
  return { particles };
}

test('a rocket blast sends its fire sparks to the glow layer too', () => {
  const scene = sceneWith('rocket-exploded', { x: 100, y: 100, strength: 'light' });
  const gameContext = recordingContext();
  const glowContext = recordingContext();
  drawParticles(gameContext, scene, 'front', glowContext);
  assert.ok(glowContext.fills.length > 0);
  assert.deepEqual(glowContext.fills, gameContext.fills);
});

test('sparks that are not fire never reach the glow layer', () => {
  const scene = sceneWith('ice-shattered', { x: 100, y: 100 });
  const glowContext = recordingContext();
  drawParticles(recordingContext(), scene, 'front', glowContext);
  assert.equal(glowContext.fills.length, 0);
});

test('a rocket draws its body and flame onto the glow layer too', () => {
  const rocket = new Rocket({ x: 50, y: 60, facing: 1, shooterId: 'red' });
  const gameContext = recordingContext();
  const glowContext = recordingContext();
  rocket.render(gameContext, { glowContext });
  assert.deepEqual(glowContext.fills, gameContext.fills);
});

test('a rocket drawn without a glow layer only draws the game layer', () => {
  const rocket = new Rocket({ x: 50, y: 60, facing: 1, shooterId: 'red' });
  const gameContext = recordingContext();
  rocket.render(gameContext);
  assert.equal(gameContext.fills.length, 2);
});
