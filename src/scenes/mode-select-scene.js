import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../engine/config.js';
import { EventEmitter } from '../engine/events.js';
import { mergeLocalInputs } from '../engine/input.js';
import {
  drawKeyHints,
  drawMenuList,
  drawMenuTitle,
  drawWithMenuMotion,
  KEYCAP_HEIGHT,
  MenuMotion,
  menuPanelSize,
  menuRowRectangles,
  rowIndexAt,
  TITLE_HEIGHT,
  wrapMenuIndex,
} from '../ui/menu-kit.js';
import { MENU_BACKGROUND_COLOR, NO_WATER_LINE_Y } from '../ui/menu-screen.js';
import { drawText } from '../ui/text.js';
import { LevelSelectScene } from './level-select-scene.js';
import { MATCH_MODES } from './match-modes.js';

const TITLE_GAP = 14;
const DESCRIPTION_GAP = 10;
const DESCRIPTION_HEIGHT = 5;
const HINT_GAP = 14;
const DESCRIPTION_COLOR = '#c0cbdc';
const HINTS = [
  { keys: ['Up', 'Down'], pad: ['stick'], label: 'Choose' },
  { keys: ['Enter'], pad: ['south'], label: 'Select' },
];

// The title, the mode list, the picked mode's description and the key hints, centered as one block.
export function modeSelectLayout() {
  const panelHeight = menuPanelSize(MATCH_MODES.map((mode) => mode.name)).height;
  const stackHeight =
    TITLE_HEIGHT + TITLE_GAP + panelHeight + DESCRIPTION_GAP + DESCRIPTION_HEIGHT + HINT_GAP + KEYCAP_HEIGHT;
  const titleY = Math.floor((SCREEN_HEIGHT - stackHeight) / 2);
  const menuTopY = titleY + TITLE_HEIGHT + TITLE_GAP;
  const descriptionY = menuTopY + panelHeight + DESCRIPTION_GAP;
  return { titleY, menuTopY, descriptionY, hintY: descriptionY + DESCRIPTION_HEIGHT + HINT_GAP };
}

// Between player select and level select: any player moves the one cursor and picks how the match is played.
export class ModeSelectScene {
  constructor({ sceneManager, levels, characterByPlayerId, sprites = {}, seed = Date.now() }) {
    this.sceneManager = sceneManager;
    this.levels = levels;
    this.characterByPlayerId = characterByPlayerId;
    this.sprites = sprites;
    this.seed = seed;
    this.events = new EventEmitter();
    this.musicTrackName = 'menu';
    this.waterLineY = NO_WATER_LINE_Y;
    this.selectedIndex = 0;
    this.menuMotion = new MenuMotion();
    this.backgroundDrawn = false;
    // Captured on the first tick, so the jump that readied a player never picks a mode.
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

    if (isFresh('down')) this.selectedIndex = wrapMenuIndex(this.selectedIndex, 1, MATCH_MODES.length);
    if (isFresh('up')) this.selectedIndex = wrapMenuIndex(this.selectedIndex, -1, MATCH_MODES.length);
    if (isFresh('down') || isFresh('up')) this.events.emit('menu-moved', {});
    const labels = MATCH_MODES.map((mode) => mode.name);
    const tappedIndex = rowIndexAt(menuRowRectangles(labels, modeSelectLayout().menuTopY), input.tap);
    if (tappedIndex >= 0) this.selectedIndex = tappedIndex;
    if (isFresh('confirm') || isFresh('jump') || tappedIndex >= 0) {
      this.events.emit('menu-selected', {});
      this.chooseMode(MATCH_MODES[this.selectedIndex].id);
    }
  }

  chooseMode(modeId) {
    this.sceneManager.setScene(
      new LevelSelectScene({
        sceneManager: this.sceneManager,
        levels: this.levels,
        characterByPlayerId: this.characterByPlayerId,
        sprites: this.sprites,
        seed: this.seed,
        mode: modeId,
      }),
    );
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
    const { titleY, menuTopY, descriptionY, hintY } = modeSelectLayout();
    drawWithMenuMotion(context, this.menuMotion, () => {
      drawMenuTitle(context, 'Mode', titleY);
      drawMenuList(context, {
        options: MATCH_MODES.map((mode) => ({ label: mode.name })),
        selectedIndex: this.selectedIndex,
        topY: menuTopY,
        motion: this.menuMotion,
      });
      drawText(context, MATCH_MODES[this.selectedIndex].description, SCREEN_WIDTH / 2, descriptionY, {
        scale: 1,
        align: 'center',
        color: DESCRIPTION_COLOR,
        outlineColor: null,
      });
      drawKeyHints(context, HINTS, hintY);
    });
  }
}
