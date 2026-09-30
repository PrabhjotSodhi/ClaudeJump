import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  CRANE_HOOK_HEIGHT,
  CRANE_HOOK_WIDTH,
  STEAM_VENT_BLAST_TICKS,
  STEAM_VENT_REST_TICKS,
  STEAM_VENT_WARNING_TICKS,
} from '../src/engine/config.js';
import { EventEmitter } from '../src/engine/events.js';
import { SteamVent } from '../src/entities/steam-vent.js';

const palette = new Set(
  Object.values(JSON.parse(readFileSync('data/palette.json', 'utf8')).ramps)
    .flat()
    .map((color) => color.toLowerCase()),
);

test('the crane hook sprite fills its hitbox in palette colors', () => {
  const props = JSON.parse(readFileSync('data/sprites/props.json', 'utf8'));
  const rows = props.frames['crane-hook'];
  assert.equal(rows.length, CRANE_HOOK_HEIGHT);
  for (const row of rows) assert.equal(row.length, CRANE_HOOK_WIDTH);
  for (const key of new Set(rows.join(''))) {
    const color = props.colors[key];
    assert.ok(color === null || palette.has(color.toLowerCase()), `crane hook uses ${color}`);
  }
});

test('a steam vent hisses once as each warning begins', () => {
  const events = new EventEmitter();
  const hisses = [];
  events.on('steam-vent-hissed', (event) => hisses.push(event));
  const vent = new SteamVent({ x: 100, y: 200 });
  const cycleTicks = STEAM_VENT_REST_TICKS + STEAM_VENT_WARNING_TICKS + STEAM_VENT_BLAST_TICKS;

  for (let tick = 0; tick < cycleTicks * 2; tick++) vent.update({ players: [], events });

  assert.deepEqual(hisses, [{ x: 100 }, { x: 100 }]);
});

test('the hiss has a sound', () => {
  const sounds = JSON.parse(readFileSync('data/sfx/sounds.json', 'utf8'));
  const eventSounds = JSON.parse(readFileSync('data/sfx/event-sounds.json', 'utf8'));
  assert.ok(sounds[eventSounds['steam-vent-hissed']]?.length > 0);
});
