import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHARACTERS } from '../src/entities/characters.js';
import { PLAYERS } from '../src/levels/versus-arena.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { PLAYER_SHAPE_SIZE, playerShapeRows } from '../src/ui/player-shapes.js';
import { harborLevel } from './fixtures/harbor-level.mjs';

test('every player slot has its own shape, so color is never the only cue', () => {
  const shapes = PLAYERS.map(({ id }) => playerShapeRows(id).join('/'));

  assert.equal(new Set(shapes).size, PLAYERS.length);
  for (const { id } of PLAYERS) {
    const rows = playerShapeRows(id);
    assert.equal(rows.length, PLAYER_SHAPE_SIZE);
    for (const row of rows) assert.equal(row.length, PLAYER_SHAPE_SIZE);
  }
});

test('in a four player match each player is outlined in their own slot color', () => {
  const players = PLAYERS.map(({ id }, index) => ({ id, character: CHARACTERS[index] }));
  const scene = new VersusScene({ level: harborLevel, seed: 0, players });

  for (const { id, color } of PLAYERS)
    assert.equal(scene.players.find((player) => player.id === id).outlineColor, color);
});
