import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLAYERS } from '../src/levels/versus-arena.js';
import { emptyCardMessage } from '../src/scenes/player-select-scene.js';
import {
  emptySelectCardLines,
  SELECT_CARD_HEIGHT,
  SELECT_CARD_WIDTH,
  selectCardMessageLines,
  selectCardRows,
} from '../src/ui/select-card.js';
import { measureText, TEXT_GLYPH_HEIGHT, textOutlineMargin } from '../src/ui/text.js';

const JOIN_MESSAGES = ['Press jump to join', 'Press jump on pad 3', 'Open seat', 'Waiting for a player'];

test('at phone size every join message wraps to lines that fit inside the card', () => {
  for (const message of JOIN_MESSAGES) {
    const lines = selectCardMessageLines(message, 2);
    assert.equal(lines.join(' '), message);
    assert.ok(lines.length <= 3);
    for (const line of lines) assert.ok(measureText(line) * 2 < SELECT_CARD_WIDTH - 8);
  }
});

test('a message that fits stays on one line', () => {
  assert.deepEqual(selectCardMessageLines('Press jump to join', 1), ['Press jump to join']);
});

const TEXT_SCALES_BY_SCREEN = [1, 2];

test('every empty player select card keeps its message inside the card and below the seat label', () => {
  const [label] = selectCardRows(1);
  for (const textScale of TEXT_SCALES_BY_SCREEN) {
    for (const spawn of PLAYERS) {
      const lines = emptySelectCardLines(emptyCardMessage(spawn.id), textScale);
      for (const line of lines) {
        const margin = textOutlineMargin(textScale);
        assert.ok(line.offsetY - margin > label.bottom, `${spawn.id} at ${textScale}x: "${line.text}" hits the label`);
        const bottom = line.offsetY + (TEXT_GLYPH_HEIGHT / 2) * textScale + margin;
        assert.ok(bottom <= SELECT_CARD_HEIGHT, `${spawn.id} at ${textScale}x: "${line.text}" leaves the card`);
      }
    }
  }
});

test('a filled card stacks label, pedestal, name and status without overlap at both text sizes', () => {
  for (const textScale of TEXT_SCALES_BY_SCREEN) {
    const rows = selectCardRows(textScale);
    for (let index = 1; index < rows.length; index++) {
      assert.ok(rows[index].top >= rows[index - 1].bottom, `row ${index} overlaps the one above at ${textScale}x`);
    }
    assert.ok(rows.at(-1).bottom <= SELECT_CARD_HEIGHT);
  }
});
