import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { EventEmitter } from '../engine/events.js';
import {
  BACK_HINT,
  drawKeyHints,
  drawMenuTitle,
  drawWithMenuMotion,
  KEYCAP_HEIGHT,
  MenuMotion,
  MOVE_HINT,
  SELECT_HINT,
  TITLE_HEIGHT,
} from '../ui/menu-kit.js';
import { MenuInput } from '../ui/menu-input.js';
import { MENU_BACKGROUND_COLOR, NO_WATER_LINE_Y } from '../ui/menu-screen.js';
import { drawText } from '../ui/text.js';
import {
  BACK_ITEM,
  CODE_LENGTH,
  DELETE_ITEM,
  GRID_COLUMNS,
  GRID_ITEMS,
  JOIN_ITEM,
  RoomCodeEntry,
} from './room-code-entry.js';

const TITLE_GAP = 14;
const SLOT_WIDTH = 36;
const SLOT_HEIGHT = 44;
const SLOT_GAP = 8;
const SLOTS_GAP = 16;
const LETTER_SCALE = 6;
const GLYPH_HEIGHT = 5;
const CURSOR_BAR_WIDTH = 16;
const TILE_WIDTH = 34;
const TILE_HEIGHT = 26;
const TILE_GAP = 4;
const HINT_GAP = 14;
const SELECTED_COLOR = '#feae34';
const LETTER_COLOR = '#c0cbdc';
const DISABLED_COLOR = '#5a6988';
const EMPTY_BAR_COLOR = '#3a4466';
const OUTLINE_COLOR = '#3e2731';
const HINTS = [MOVE_HINT, SELECT_HINT, { ...BACK_HINT, label: 'Delete' }];
const TILE_LABELS = { [DELETE_ITEM]: 'Del', [JOIN_ITEM]: 'Join', [BACK_ITEM]: 'Back' };

// Every rectangle of the screen, in whole pixels. The title, the four code slots, the letter grid and the hints
// are centered on the screen as one block. `tiles` is in GRID_ITEMS order.
export function joinLayout() {
  const rowCount = Math.ceil(GRID_ITEMS.length / GRID_COLUMNS);
  const slotsWidth = CODE_LENGTH * SLOT_WIDTH + (CODE_LENGTH - 1) * SLOT_GAP;
  const gridWidth = GRID_COLUMNS * TILE_WIDTH + (GRID_COLUMNS - 1) * TILE_GAP;
  const gridHeight = rowCount * TILE_HEIGHT + (rowCount - 1) * TILE_GAP;
  const stackHeight = TITLE_HEIGHT + TITLE_GAP + SLOT_HEIGHT + SLOTS_GAP + gridHeight + HINT_GAP + KEYCAP_HEIGHT;
  const titleY = Math.floor((SCREEN_HEIGHT - stackHeight) / 2);
  const slotsY = titleY + TITLE_HEIGHT + TITLE_GAP;
  const gridY = slotsY + SLOT_HEIGHT + SLOTS_GAP;
  const slots = Array.from({ length: CODE_LENGTH }, (_, index) => ({
    x: (SCREEN_WIDTH - slotsWidth) / 2 + index * (SLOT_WIDTH + SLOT_GAP),
    y: slotsY,
    width: SLOT_WIDTH,
    height: SLOT_HEIGHT,
  }));
  const tiles = GRID_ITEMS.map((item, index) => ({
    x: (SCREEN_WIDTH - gridWidth) / 2 + (index % GRID_COLUMNS) * (TILE_WIDTH + TILE_GAP),
    y: gridY + Math.floor(index / GRID_COLUMNS) * (TILE_HEIGHT + TILE_GAP),
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
  }));
  return { titleY, slots, tiles, hintY: gridY + gridHeight + HINT_GAP };
}

// Typing the room code to join. `onJoin(code)` gets the four letters and `onBack()` leaves. Back deletes a letter,
// and leaves once the code is empty.
export class OnlineJoinScene {
  constructor({ onJoin, onBack }) {
    this.events = new EventEmitter();
    this.musicTrackName = 'menu';
    this.waterLineY = NO_WATER_LINE_Y;
    this.onJoin = onJoin;
    this.onBack = onBack;
    this.entry = new RoomCodeEntry();
    this.menuMotion = new MenuMotion();
    this.backgroundDrawn = false;
    // Seeded on the first tick, so a press still held from the screen before never counts here.
    this.menuInput = null;
  }

  update(inputByPlayerId) {
    this.menuMotion.update();
    if (!this.menuInput) {
      this.menuInput = new MenuInput(inputByPlayerId);
      return;
    }
    const presses = this.menuInput.presses(inputByPlayerId);

    let outcome = null;
    if (presses.left) this.entry.moveAcross(-1);
    if (presses.right) this.entry.moveAcross(1);
    if (presses.up) this.entry.moveDown(-1);
    if (presses.down) this.entry.moveDown(1);
    if (presses.left || presses.right || presses.up || presses.down) this.events.emit('menu-moved', {});
    if (presses.confirm) outcome = this.press(() => this.entry.press());
    else if (presses.back) outcome = this.press(() => this.entry.back());

    if (outcome === 'join') this.onJoin(this.entry.code);
    if (outcome === 'back') this.onBack();
  }

  press(pressEntry) {
    this.events.emit('menu-selected', {});
    return pressEntry();
  }

  render(renderer) {
    if (!this.backgroundDrawn) {
      renderer.updateBackground((context) => {
        context.fillStyle = MENU_BACKGROUND_COLOR;
        context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
      });
      this.backgroundDrawn = true;
    }
    renderer.clearGameLayer();
    renderer.clearUiLayer();
    drawWithMenuMotion(renderer.uiContext, this.menuMotion, () => drawJoinUi(renderer.uiContext, this));
  }
}

// Each slot is a typed letter, or a bar under where the next letter goes.
function drawSlot(context, slot, letter, isNext) {
  if (letter) {
    const letterTopY = slot.y + Math.floor((slot.height - GLYPH_HEIGHT * LETTER_SCALE) / 2);
    drawText(context, letter, slot.x + slot.width / 2, letterTopY, {
      scale: LETTER_SCALE,
      align: 'center',
      color: SELECTED_COLOR,
      outlineColor: OUTLINE_COLOR,
    });
    return;
  }
  context.fillStyle = isNext ? SELECTED_COLOR : EMPTY_BAR_COLOR;
  context.fillRect(slot.x + (slot.width - CURSOR_BAR_WIDTH) / 2, slot.y + slot.height - 10, CURSOR_BAR_WIDTH, 3);
}

// Each grid item is outlined text straight on the scene. The selected one is bigger and in the selected color. The
// word items are a size smaller so they fit their tile.
function drawTile(context, tile, item, { isSelected, isDisabled }) {
  const scale = (isSelected ? 3 : 2) - (item in TILE_LABELS ? 1 : 0);
  let color = isSelected ? SELECTED_COLOR : LETTER_COLOR;
  if (isDisabled) color = DISABLED_COLOR;
  const label = TILE_LABELS[item] ?? item;
  drawText(context, label, tile.x + tile.width / 2, tile.y + Math.floor((tile.height - GLYPH_HEIGHT * scale) / 2), {
    scale,
    align: 'center',
    color,
    outlineColor: OUTLINE_COLOR,
  });
}

function drawJoinUi(context, scene) {
  const { titleY, slots, tiles, hintY } = joinLayout();
  const { code } = scene.entry;
  drawMenuTitle(context, 'Join a room', titleY);
  slots.forEach((slot, index) => drawSlot(context, slot, code[index], index === code.length));
  GRID_ITEMS.forEach((item, index) => {
    drawTile(context, tiles[index], item, {
      isSelected: index === scene.entry.cursorIndex,
      isDisabled: item === JOIN_ITEM && !scene.entry.isComplete,
    });
  });
  drawKeyHints(context, HINTS, hintY);
}
