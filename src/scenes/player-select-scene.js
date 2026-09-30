import { SCREEN_HEIGHT, SCREEN_WIDTH, TICK_RATE } from '../engine/config.js';
import { EventEmitter } from '../engine/events.js';
import { CHARACTERS, HOVER_CHARACTER_BY_PLAYER_ID } from '../entities/characters.js';
import { PLAYERS } from '../levels/versus-arena.js';
import {
  drawKeyHintPanel,
  drawMenuTitle,
  drawWithMenuMotion,
  MenuMotion,
  rowIndexAt,
  tapPoint,
} from '../ui/menu-kit.js';
import { MENU_BACKGROUND_COLOR, NO_WATER_LINE_Y } from '../ui/menu-screen.js';
import {
  drawEmptySelectCard,
  drawSelectCard,
  pickArrowDirectionAt,
  SELECT_CARD_HEIGHT,
  selectCardBox,
} from '../ui/select-card.js';
import { SelectCardMotion } from '../ui/select-card-motion.js';
import { drawText } from '../ui/text.js';
import { ModeSelectScene } from './mode-select-scene.js';

const TITLE_Y = 24;

const CARD_TOP_Y = 68;

const SELECTED_COLOR = '#feae34';
const UNJOINED_COLOR = '#c0cbdc';
const NOT_READY_COLOR = '#8b9bb4';

const HINTS_PANEL_WIDTH = 360;
const HINTS_PANEL_TOP_Y = CARD_TOP_Y + SELECT_CARD_HEIGHT + 20;
const KEY_HINT_ROWS = [
  {
    label: 'Red',
    device: 'keyboard',
    color: PLAYERS.find((spawn) => spawn.id === 'red').color,
    hints: [
      {
        keys: [
          { player: 'red', control: 'left' },
          { player: 'red', control: 'right' },
        ],
        label: 'Pick',
      },
      { keys: [{ player: 'red', control: 'jump' }], label: 'Join or lock in' },
      { keys: [{ player: 'red', control: 'action' }], label: 'Back' },
    ],
  },
  {
    label: 'Blue',
    device: 'keyboard',
    color: PLAYERS.find((spawn) => spawn.id === 'blue').color,
    hints: [
      {
        keys: [
          { player: 'blue', control: 'left' },
          { player: 'blue', control: 'right' },
        ],
        label: 'Pick',
      },
      { keys: [{ player: 'blue', control: 'jump' }], label: 'Join or lock in' },
      { keys: [{ player: 'blue', control: 'action' }], label: 'Back' },
    ],
  },
  {
    label: 'Pads',
    device: 'pad',
    color: UNJOINED_COLOR,
    hints: [
      { keys: ['Stick'], pad: ['stick'], label: 'Pick' },
      { keys: ['A'], pad: ['south'], label: 'Join or lock in' },
      { keys: ['Down'], pad: ['east'], label: 'Back' },
    ],
  },
];

// Green and yellow have no keyboard keys, so their cards name the pad to press.
const JOIN_TEXT_BY_PLAYER_ID = {
  red: 'Press jump to join',
  blue: 'Press jump to join',
  green: 'Press jump on pad 3',
  yellow: 'Press jump on pad 4',
};

// Each card goes through these states in order, one jump press apart.
const NEXT_STATE = { unjoined: 'picking', picking: 'ready' };

const MINIMUM_PLAYERS = 2;

// Once everyone who joined is ready, this many ticks pass before the match starts, so a player still reaching for
// their pad can join. A join or an un-ready cancels it.
export const START_COUNTDOWN_TICKS = 120;
const COUNTDOWN_Y = 290;

export function playerCardBox(seatIndex) {
  return selectCardBox(seatIndex, CARD_TOP_Y);
}

export class PlayerSelectScene {
  constructor({ sceneManager, levels, sprites = {}, seed = Date.now() } = {}) {
    this.sceneManager = sceneManager;
    this.events = new EventEmitter();
    this.musicTrackName = 'menu';
    this.levels = levels;
    this.sprites = sprites;
    this.seed = seed;
    this.waterLineY = NO_WATER_LINE_Y;
    this.menuMotion = new MenuMotion();
    this.backgroundDrawn = false;
    // Captured from the real input on the first tick this scene runs, so a button still held from
    // the title screen's confirm press never counts as a fresh press here.
    this.previousInput = null;
    // Render only: hops, cheers and slide-ins of the cards.
    this.cardMotion = new SelectCardMotion();
    this.countdownTicksRemaining = null;
    this.stateByPlayerId = {};
    // An index into CHARACTERS: the hovered character until the player locks it in, then the chosen one.
    this.characterIndexByPlayerId = {};
    for (const spawn of PLAYERS) {
      this.stateByPlayerId[spawn.id] = 'unjoined';
      this.characterIndexByPlayerId[spawn.id] = CHARACTERS.indexOf(HOVER_CHARACTER_BY_PLAYER_ID[spawn.id]);
    }
  }

  update(inputByPlayerId) {
    this.cardMotion.update();
    this.menuMotion.update();
    if (!this.previousInput) {
      this.previousInput = {};
      for (const spawn of PLAYERS) this.previousInput[spawn.id] = { ...inputByPlayerId[spawn.id] };
      return;
    }

    for (const spawn of PLAYERS) {
      const input = inputByPlayerId[spawn.id] ?? {};
      const previous = this.previousInput[spawn.id];
      if (this.stateByPlayerId[spawn.id] === 'picking') {
        if (input.left && !previous.left) this.changeCharacter(spawn.id, -1);
        if (input.right && !previous.right) this.changeCharacter(spawn.id, 1);
      }
      if (input.jump && !previous.jump) this.advance(spawn.id);
      else if (input.down && !previous.down) this.stepBack(spawn.id);
      this.previousInput[spawn.id] = { ...input };
    }

    this.advanceTappedCard(inputByPlayerId);

    if (!this.everyoneJoinedIsReady()) {
      this.countdownTicksRemaining = null;
    } else {
      this.countdownTicksRemaining = (this.countdownTicksRemaining ?? START_COUNTDOWN_TICKS) - 1;
    }
    if (this.countdownTicksRemaining === 0) {
      this.sceneManager.setScene(
        new ModeSelectScene({
          sceneManager: this.sceneManager,
          levels: this.levels,
          characterByPlayerId: this.pickedCharacters(),
          sprites: this.sprites,
          seed: this.seed,
        }),
      );
    }
  }

  // The match starts once at least two players are ready and nobody who joined is still picking.
  // Players who never joined take no part.
  everyoneJoinedIsReady() {
    const states = Object.values(this.stateByPlayerId);
    const readyCount = states.filter((state) => state === 'ready').length;
    return readyCount >= MINIMUM_PLAYERS && states.every((state) => state !== 'picking');
  }

  // Touch drives the first player. A tap on their card joins, then locks in. While picking, a tap on
  // either arrow changes the character instead.
  advanceTappedCard(inputByPlayerId) {
    const point = tapPoint(inputByPlayerId);
    const box = playerCardBox(0);
    if (rowIndexAt([box], point) !== 0) return;
    const playerId = PLAYERS[0].id;
    const direction = pickArrowDirectionAt(box, point);
    if (this.stateByPlayerId[playerId] === 'picking' && direction !== 0) this.changeCharacter(playerId, direction);
    else this.advance(playerId);
  }

  // Down steps back: a ready player goes back to picking, and a player who joined by mistake steps out,
  // so nobody holds the others up.
  stepBack(playerId) {
    const previousState = { picking: 'unjoined', ready: 'picking' }[this.stateByPlayerId[playerId]];
    if (!previousState) return;
    this.stateByPlayerId[playerId] = previousState;
    this.events.emit('menu-moved', { playerId });
  }

  advance(playerId) {
    const state = this.stateByPlayerId[playerId];
    if (!(state in NEXT_STATE)) return;
    this.stateByPlayerId[playerId] = NEXT_STATE[state];
    this.events.emit('menu-selected', { playerId });
    const seatIndex = PLAYERS.findIndex((spawn) => spawn.id === playerId);
    if (this.stateByPlayerId[playerId] === 'picking') this.cardMotion.join(seatIndex);
    if (this.stateByPlayerId[playerId] === 'ready') {
      this.cardMotion.cheer(seatIndex);
      this.events.emit('character-cheered', {
        playerId,
        characterName: CHARACTERS[this.characterIndexByPlayerId[playerId]].name,
      });
      this.moveHoveringPlayersOff(playerId);
    }
  }

  isLockedByOther(playerId, characterIndex) {
    return PLAYERS.some(
      (spawn) =>
        spawn.id !== playerId &&
        this.stateByPlayerId[spawn.id] === 'ready' &&
        this.characterIndexByPlayerId[spawn.id] === characterIndex,
    );
  }

  // The next character in that direction that the other player has not locked in.
  nextFreeCharacterIndex(playerId, direction) {
    let index = this.characterIndexByPlayerId[playerId];
    do {
      index = (index + direction + CHARACTERS.length) % CHARACTERS.length;
    } while (this.isLockedByOther(playerId, index));
    return index;
  }

  changeCharacter(playerId, direction) {
    this.characterIndexByPlayerId[playerId] = this.nextFreeCharacterIndex(playerId, direction);
    this.cardMotion.hop(PLAYERS.findIndex((spawn) => spawn.id === playerId));
    this.events.emit('menu-moved', { playerId });
  }

  // Anyone still hovering on the character that was just locked in moves on to the next free one.
  moveHoveringPlayersOff(lockedPlayerId) {
    for (const spawn of PLAYERS) {
      if (spawn.id === lockedPlayerId || this.stateByPlayerId[spawn.id] === 'ready') continue;
      if (this.characterIndexByPlayerId[spawn.id] === this.characterIndexByPlayerId[lockedPlayerId]) {
        this.changeCharacter(spawn.id, 1);
      }
    }
  }

  // Only the ready players, in seat order.
  pickedCharacters() {
    const characterByPlayerId = {};
    for (const spawn of PLAYERS) {
      if (this.stateByPlayerId[spawn.id] === 'ready')
        characterByPlayerId[spawn.id] = CHARACTERS[this.characterIndexByPlayerId[spawn.id]];
    }
    return characterByPlayerId;
  }

  render(renderer) {
    if (!this.backgroundDrawn) {
      renderer.updateBackground((context) => drawPlayerSelectBackground(context));
      this.backgroundDrawn = true;
    }

    renderer.clearGameLayer();
    renderer.clearUiLayer();
    drawWithMenuMotion(renderer.uiContext, this.menuMotion, () =>
      drawPlayerSelectUi(renderer.uiContext, this, renderer.touchActive ? 2 : 1),
    );
  }
}

function drawPlayerSelectBackground(context) {
  context.fillStyle = MENU_BACKGROUND_COLOR;
  context.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
}

function drawPlayerCard(context, scene, spawn, textScale) {
  const state = scene.stateByPlayerId[spawn.id];
  const seatIndex = PLAYERS.indexOf(spawn);
  const box = playerCardBox(seatIndex);
  if (state === 'unjoined') {
    drawEmptySelectCard(context, box, spawn, [JOIN_TEXT_BY_PLAYER_ID[spawn.id]], textScale);
    return;
  }
  context.save();
  context.translate(scene.cardMotion.slideOffsetX(seatIndex, box), 0);
  drawSelectCard(context, {
    box,
    spawn,
    character: CHARACTERS[scene.characterIndexByPlayerId[spawn.id]],
    sprites: scene.sprites,
    pose: scene.cardMotion.pose(seatIndex),
    canPick: state === 'picking',
    status:
      state === 'ready' ? { text: 'READY!', color: SELECTED_COLOR } : { text: 'Not ready', color: NOT_READY_COLOR },
    textScale,
  });
  context.restore();
}

// Touch means a phone, where the card text is drawn at textScale 2 so it stays readable.
function drawPlayerSelectUi(context, scene, textScale) {
  drawMenuTitle(context, 'Player Select', TITLE_Y);
  for (const spawn of PLAYERS) drawPlayerCard(context, scene, spawn, textScale);
  drawKeyHintPanel(context, KEY_HINT_ROWS, { topY: HINTS_PANEL_TOP_Y, width: HINTS_PANEL_WIDTH });
  if (scene.countdownTicksRemaining !== null) {
    drawText(
      context,
      `Starting in ${Math.ceil(scene.countdownTicksRemaining / TICK_RATE)}`,
      SCREEN_WIDTH / 2,
      COUNTDOWN_Y,
      { scale: 2, align: 'center', color: SELECTED_COLOR },
    );
  }
}
