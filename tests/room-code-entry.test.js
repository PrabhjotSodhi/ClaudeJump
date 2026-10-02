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

function pressItem(entry, itemIndex) {
  entry.cursorIndex = itemIndex;
  return entry.press();
}

function typeLetters(entry, letters) {
  for (const letter of letters) pressItem(entry, GRID_ITEMS.indexOf(letter));
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

  pressItem(entry, GRID_ITEMS.indexOf(DELETE_ITEM));
  assert.equal(entry.code, 'A');
  pressItem(entry, GRID_ITEMS.indexOf(DELETE_ITEM));
  pressItem(entry, GRID_ITEMS.indexOf(DELETE_ITEM));

  assert.equal(entry.code, '');
});

test('Join does nothing until all four letters are in, then sends the code', () => {
  const entry = new RoomCodeEntry();
  typeLetters(entry, 'ABC');

  assert.equal(pressItem(entry, GRID_ITEMS.indexOf(JOIN_ITEM)), null);

  typeLetters(entry, 'D');
  assert.equal(entry.press(), 'join');
  assert.equal(entry.code, 'ABCD');
});

test('Back leaves and keeps the code', () => {
  const entry = new RoomCodeEntry();
  typeLetters(entry, 'AB');

  assert.equal(pressItem(entry, GRID_ITEMS.indexOf(BACK_ITEM)), 'back');
  assert.equal(entry.code, 'AB');
});

test('the letters are the ones the rooms function makes codes from', () => {
  assert.equal(CODE_LENGTH, 4);
  assert.equal(CODE_LETTERS.join(''), 'ABCDEFGHJKMNPQRSTUVWXYZ');
  assert.ok(!GRID_ITEMS.slice(0, CODE_LETTERS.length).some((item) => 'ILO'.includes(item)));
});

test('moving left and right steps through every item in order and wraps at both ends', () => {
  const entry = new RoomCodeEntry();

  entry.moveAcross(-1);
  assert.equal(entry.selectedItem, BACK_ITEM);
  entry.moveAcross(1);
  assert.equal(entry.selectedItem, 'A');
  moveTo(entry, GRID_ITEMS[8]);
  entry.moveAcross(1);
  assert.equal(entry.selectedItem, GRID_ITEMS[9], 'right from the end of a row goes on to the next row');
});

test('back deletes the last letter, then leaves once the code is empty', () => {
  const entry = new RoomCodeEntry();
  typeLetters(entry, 'AB');

  assert.equal(entry.back(), null);
  assert.equal(entry.code, 'A');
  assert.equal(entry.back(), null);
  assert.equal(entry.back(), 'back');
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
