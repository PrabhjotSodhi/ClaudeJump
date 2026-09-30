import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SELECT_CARD_WIDTH, selectCardMessageLines } from '../src/ui/select-card.js';
import { measureText } from '../src/ui/text.js';

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
