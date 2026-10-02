import { wrapMenuIndex } from '../ui/menu-kit.js';

export const CODE_LENGTH = 4;
// The letters room codes are made of. The rooms function leaves out I, L and O so codes are easy to read out.
export const CODE_LETTERS = [...'ABCDEFGHJKMNPQRSTUVWXYZ'];
export const GRID_COLUMNS = 9;

export const DELETE_ITEM = 'delete';
export const JOIN_ITEM = 'join';
export const BACK_ITEM = 'back';
export const GRID_ITEMS = [...CODE_LETTERS, DELETE_ITEM, JOIN_ITEM, BACK_ITEM];

// Typing a room code with a cursor over a grid of letters, so a pad, keys or the touch buttons all work.
// `press()` returns 'join' when a full code is sent and 'back' when the player leaves, otherwise null.
export class RoomCodeEntry {
  constructor() {
    this.code = '';
    this.cursorIndex = 0;
  }

  get selectedItem() {
    return GRID_ITEMS[this.cursorIndex];
  }

  get isComplete() {
    return this.code.length === CODE_LENGTH;
  }

  // Left and right step through every item in reading order and wrap, so the whole grid is reachable with them alone.
  moveAcross(direction) {
    this.cursorIndex = wrapMenuIndex(this.cursorIndex, direction, GRID_ITEMS.length);
  }

  // Up and down keep the column and wrap. A column the short last row lacks lands on its last item.
  moveDown(direction) {
    const rowCount = Math.ceil(GRID_ITEMS.length / GRID_COLUMNS);
    const row = wrapMenuIndex(Math.floor(this.cursorIndex / GRID_COLUMNS), direction, rowCount);
    this.cursorIndex = Math.min(row * GRID_COLUMNS + (this.cursorIndex % GRID_COLUMNS), GRID_ITEMS.length - 1);
  }

  press() {
    const item = this.selectedItem;
    if (item === BACK_ITEM) return 'back';
    if (item === DELETE_ITEM) {
      this.code = this.code.slice(0, -1);
    } else if (item === JOIN_ITEM) {
      return this.isComplete ? 'join' : null;
    } else if (!this.isComplete) {
      this.code += item;
      if (this.isComplete) this.cursorIndex = GRID_ITEMS.indexOf(JOIN_ITEM);
    }
    return null;
  }

  // Back deletes the last letter, and with no letters left it leaves: 'back', otherwise null.
  back() {
    if (this.code.length === 0) return 'back';
    this.code = this.code.slice(0, -1);
    return null;
  }
}
