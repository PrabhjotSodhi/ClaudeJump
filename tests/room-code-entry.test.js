import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BACK_ITEM,
  CODE_LENGTH,
  CODE_LETTERS,
  DELETE_ITEM,
  GRID_ITEMS,
  JOIN_ITEM,
  RoomCodeEntry,
} from '../src/scenes/room-code-entry.js';

function moveTo(entry, item) {
  entry.cursorIndex = GRID_ITEMS.indexOf(item);
}

function typeLetters(entry, letters) {
  for (const letter of letters) entry.pressItem(GRID_ITEMS.indexOf(letter));
}

test('pressing letters builds the code in order', () => {
  const entry = new RoomCodeEntry();

  typeLetters(entry, 'KQ');

  assert.equal(entry.code, 'KQ');
});

test('a code stops growing at four letters', () => {
  const entry = new RoomCodeEntry();

  typeLetters(entry, 'ABCDE');

  assert.equal(entry.code, 'ABCD');
  assert.equal(entry.isComplete, true);
});

test('the cursor jumps to Join when the fourth letter goes in', () => {
  const entry = new RoomCodeEntry();

  typeLetters(entry, 'ABC');
  assert.notEqual(entry.selectedItem, JOIN_ITEM);
  typeLetters(entry, 'D');

  assert.equal(entry.selectedItem, JOIN_ITEM);
});

test('Delete removes the last letter and does nothing on an empty code', () => {
  const entry = new RoomCodeEntry();
  typeLetters(entry, 'AB');

  entry.pressItem(GRID_ITEMS.indexOf(DELETE_ITEM));
  assert.equal(entry.code, 'A');
  entry.pressItem(GRID_ITEMS.indexOf(DELETE_ITEM));
  entry.pressItem(GRID_ITEMS.indexOf(DELETE_ITEM));

  assert.equal(entry.code, '');
});

test('Join does nothing until all four letters are in, then sends the code', () => {
  const entry = new RoomCodeEntry();
  typeLetters(entry, 'ABC');

  assert.equal(entry.pressItem(GRID_ITEMS.indexOf(JOIN_ITEM)), null);

  typeLetters(entry, 'D');
  assert.equal(entry.press(), 'join');
  assert.equal(entry.code, 'ABCD');
});

test('Back leaves and keeps the code', () => {
  const entry = new RoomCodeEntry();
  typeLetters(entry, 'AB');

  assert.equal(entry.pressItem(GRID_ITEMS.indexOf(BACK_ITEM)), 'back');
  assert.equal(entry.code, 'AB');
});

test('the letters are the ones the rooms function makes codes from', () => {
  assert.equal(CODE_LENGTH, 4);
  assert.equal(CODE_LETTERS.join(''), 'ABCDEFGHJKMNPQRSTUVWXYZ');
  assert.ok(!GRID_ITEMS.slice(0, CODE_LETTERS.length).some((item) => 'ILO'.includes(item)));
});

test('moving right wraps inside the row', () => {
  const entry = new RoomCodeEntry();

  entry.moveAcross(-1);
  assert.equal(entry.selectedItem, GRID_ITEMS[8]);
  entry.moveAcross(1);
  assert.equal(entry.selectedItem, 'A');
});

test('moving right in the short last row wraps inside that row', () => {
  const entry = new RoomCodeEntry();
  moveTo(entry, BACK_ITEM);

  entry.moveAcross(1);

  assert.equal(entry.selectedItem, GRID_ITEMS[18]);
});

test('moving down keeps the column and wraps from the last row to the first', () => {
  const entry = new RoomCodeEntry();
  entry.cursorIndex = 3;

  entry.moveDown(1);
  assert.equal(entry.cursorIndex, 12);
  entry.moveDown(1);
  assert.equal(entry.cursorIndex, 21);
  entry.moveDown(1);
  assert.equal(entry.cursorIndex, 3);
  entry.moveDown(-1);
  assert.equal(entry.cursorIndex, 21);
});

test('moving down into a column the short last row lacks lands on its last item', () => {
  const entry = new RoomCodeEntry();
  entry.cursorIndex = 8 + 9;

  entry.moveDown(1);

  assert.equal(entry.selectedItem, BACK_ITEM);
});
