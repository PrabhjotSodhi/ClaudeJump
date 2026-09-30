import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { EventEmitter } from '../engine/events.js';
import { mergeLocalInputs } from '../engine/input.js';
import {
  drawKeyHints,
  drawMenuTitle,
  drawWithMenuMotion,
  KEYCAP_HEIGHT,
  MenuMotion,
  rowIndexAt,
  TITLE_HEIGHT,
} from '../ui/menu-kit.js';
import { MENU_BACKGROUND_COLOR, NO_WATER_LINE_Y } from '../ui/menu-screen.js';
import { drawPanel } from '../ui/panel.js';
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
const LETTER_SCALE = 4;
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
const HINTS = [
  { keys: ['Left', 'Right', 'Up', 'Down'], pad: ['stick'], label: 'Move' },
  { keys: ['Enter'], pad: ['south'], label: 'Choose' },
];
const TILE_LABELS = { [DELETE_ITEM]: 'Del', [JOIN_ITEM]: 'Join', [BACK_ITEM]: 'Back' };

// Every rectangle of the screen, in whole pixels. The title, the four code slots, the letter grid and the hints
// are centered on the screen as one block. `tiles` is in GRID_ITEMS order, for drawing and for taps.
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

// Typing the room code to join. `onJoin(code)` gets the four letters and `onBack()` leaves.
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
    // Captured on the first tick, so a press still held from the screen before never counts here.
    this.previousInput = null;
  }

  update(inputByPlayerId) {
    this.menuMotion.update();
    const input = mergeLocalInputs(inputByPlayerId);
    if (!this.previousInput) {
      this.previousInput = input;
      return;
    }
    const previous = this.previousInput;
    const isFresh = (control) => input[control] && !previous[control];
    this.previousInput = input;

    let outcome = null;
    if (isFresh('left')) this.entry.moveAcross(-1);
    if (isFresh('right')) this.entry.moveAcross(1);
    if (isFresh('up')) this.entry.moveDown(-1);
    if (isFresh('down')) this.entry.moveDown(1);
    if (isFresh('left') || isFresh('right') || isFresh('up') || isFresh('down')) this.events.emit('menu-moved', {});
    if (isFresh('confirm')) outcome = this.press(() => this.entry.press());
    const tappedIndex = rowIndexAt(joinLayout().tiles, input.tap);
    if (tappedIndex >= 0) outcome = this.press(() => this.entry.pressItem(tappedIndex));

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
    drawWithMenuMotion(renderer.uiContext, this.menuMotion, () =>
      drawJoinUi(renderer.uiContext, this, renderer.touchActive),
    );
  }
}

function drawSlot(context, slot, letter, isNext) {
  drawPanel(context, slot.x, slot.y, slot.width, slot.height);
  if (letter) {
    const letterTopY = slot.y + Math.floor((slot.height - GLYPH_HEIGHT * LETTER_SCALE) / 2);
    drawText(context, letter, slot.x + slot.width / 2, letterTopY, {
      scale: LETTER_SCALE,
      align: 'center',
      color: SELECTED_COLOR,
    });
    return;
  }
  context.fillStyle = isNext ? SELECTED_COLOR : EMPTY_BAR_COLOR;
  context.fillRect(slot.x + (slot.width - CURSOR_BAR_WIDTH) / 2, slot.y + slot.height - 12, CURSOR_BAR_WIDTH, 2);
}

function drawTile(context, tile, item, { isSelected, isDisabled }) {
  drawPanel(context, tile.x, tile.y, tile.width, tile.height);
  if (isSelected) {
    context.fillStyle = SELECTED_COLOR;
    context.fillRect(tile.x + 1, tile.y, tile.width - 2, 1);
    context.fillRect(tile.x + 1, tile.y + tile.height - 1, tile.width - 2, 1);
    context.fillRect(tile.x, tile.y + 1, 1, tile.height - 2);
    context.fillRect(tile.x + tile.width - 1, tile.y + 1, 1, tile.height - 2);
  }
  let color = isSelected ? SELECTED_COLOR : LETTER_COLOR;
  if (isDisabled) color = DISABLED_COLOR;
  drawText(
    context,
    TILE_LABELS[item] ?? item,
    tile.x + tile.width / 2,
    tile.y + Math.floor((tile.height - GLYPH_HEIGHT) / 2),
    {
      scale: 1,
      align: 'center',
      color,
      outlineColor: null,
    },
  );
}

function drawJoinUi(context, scene, touchActive) {
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
  if (touchActive) {
    drawText(context, 'Tap the four letters', SCREEN_WIDTH / 2, hintY + 3, {
      scale: 1,
      align: 'center',
      color: LETTER_COLOR,
      outlineColor: null,
    });
  } else {
    drawKeyHints(context, HINTS, hintY);
  }
}
