import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { EventEmitter } from '../engine/events.js';
import { mergeLocalInputs } from '../engine/input.js';
import {
  drawKeyHints,
  drawMenuList,
  drawMenuTitle,
  drawWithMenuMotion,
  MenuMotion,
  KEYCAP_HEIGHT,
  menuPanelSize,
  menuRowRectangles,
  rowIndexAt,
  TITLE_HEIGHT,
  wrapMenuIndex,
} from '../ui/menu-kit.js';
import { MENU_BACKGROUND_COLOR, NO_WATER_LINE_Y } from '../ui/menu-screen.js';
import { drawText } from '../ui/text.js';

const TITLE_GAP = 14;
const LINE_HEIGHT = 12;
const LINES_GAP = 14;
const HINT_GAP = 14;
const LINE_COLOR = '#c0cbdc';
const HINTS = [
  { keys: ['Up', 'Down'], pad: ['stick'], label: 'Choose' },
  { keys: ['Enter'], pad: ['south'], label: 'Select' },
];

// The stack of title, lines, options and key hints is centered on the screen as one block.
export function onlineMenuLayout({ lines, options }) {
  const panelHeight = menuPanelSize(options.map((option) => option.label)).height;
  const linesHeight = lines.length * LINE_HEIGHT;
  const stackHeight =
    TITLE_HEIGHT + TITLE_GAP + linesHeight + (lines.length ? LINES_GAP : 0) + panelHeight + HINT_GAP + KEYCAP_HEIGHT;
  const titleY = Math.floor((SCREEN_HEIGHT - stackHeight) / 2);
  const linesY = titleY + TITLE_HEIGHT + TITLE_GAP;
  const menuTopY = linesY + linesHeight + (lines.length ? LINES_GAP : 0);
  return { titleY, linesY, menuTopY, hintY: menuTopY + panelHeight + HINT_GAP };
}

// A titled message over a short list of options. Each option is { label, onSelect }.
// The online menu, the connecting screen and every error screen are all this scene.
export class OnlineMenuScene {
  constructor({ title, lines = [], options }) {
    this.events = new EventEmitter();
    this.musicTrackName = 'menu';
    this.waterLineY = NO_WATER_LINE_Y;
    this.title = title;
    this.lines = lines;
    this.options = options;
    this.selectedIndex = 0;
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

    const optionCount = this.options.length;
    if (isFresh('down')) this.selectedIndex = wrapMenuIndex(this.selectedIndex, 1, optionCount);
    if (isFresh('up')) this.selectedIndex = wrapMenuIndex(this.selectedIndex, -1, optionCount);
    if (isFresh('down') || isFresh('up')) this.events.emit('menu-moved', {});
    const labels = this.options.map((option) => option.label);
    const tappedIndex = rowIndexAt(menuRowRectangles(labels, onlineMenuLayout(this).menuTopY), input.tap);
    if (tappedIndex >= 0) this.selectedIndex = tappedIndex;
    if (isFresh('confirm') || tappedIndex >= 0) {
      this.events.emit('menu-selected', {});
      this.menuMotion.press();
      this.options[this.selectedIndex].onSelect(inputByPlayerId);
    }
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
    const context = renderer.uiContext;
    const { titleY, linesY, menuTopY, hintY } = onlineMenuLayout(this);
    drawWithMenuMotion(context, this.menuMotion, () => {
      drawMenuTitle(context, this.title, titleY);
      this.lines.forEach((line, index) => {
        drawText(context, line, SCREEN_WIDTH / 2, linesY + index * LINE_HEIGHT, {
          scale: 1,
          align: 'center',
          color: LINE_COLOR,
          outlineColor: null,
        });
      });
      drawMenuList(context, {
        options: this.options,
        selectedIndex: this.selectedIndex,
        topY: menuTopY,
        motion: this.menuMotion,
      });
      if (!renderer.touchActive) drawKeyHints(context, HINTS, hintY);
    });
  }
}
