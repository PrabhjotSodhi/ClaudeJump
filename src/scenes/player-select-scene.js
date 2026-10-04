import { SCREEN_HEIGHT, SCREEN_WIDTH, TICK_RATE } from '../engine/config.js';
import { EventEmitter } from '../engine/events.js';
import { CHARACTERS, HOVER_CHARACTER_BY_PLAYER_ID } from '../entities/characters.js';
import { PLAYERS } from '../levels/versus-arena.js';
import { drawKeyHintRows, drawMenuTitle, drawWithMenuMotion, MenuMotion, seatHintRows } from '../ui/menu-kit.js';
import { MENU_BACKGROUND_COLOR, NO_WATER_LINE_Y } from '../ui/menu-screen.js';
import { drawEmptySelectCard, drawSelectCard, SELECT_CARD_HEIGHT, selectCardBox } from '../ui/select-card.js';
import { SelectCardMotion } from '../ui/select-card-motion.js';
import { MenuInput } from '../ui/menu-input.js';
import { drawText } from '../ui/text.js';
import { ModeSelectScene } from './mode-select-scene.js';
import { TitleScene } from './title-scene.js';

const TITLE_Y = 24;

const CARD_TOP_Y = 68;

const SELECTED_COLOR = '#feae34';
const NOT_READY_COLOR = '#8b9bb4';

const HINTS_WIDTH = 360;
const HINTS_TOP_Y = CARD_TOP_Y + SELECT_CARD_HEIGHT + 20;
const KEY_HINT_ROWS = seatHintRows('Join or ready');

// Green and yellow have no keyboard keys, so their cards name the pad to press.
const JOIN_TEXT_BY_PLAYER_ID = {
  red: 'Press jump to join',
  blue: 'Press jump to join',
  green: 'Press jump on pad 3',
  yellow: 'Press jump on pad 4',
};

// Each card goes through these states in order, one jump press apart. A seat a computer plays is taken back by its
// own player's jump.
const NEXT_STATE = { unjoined: 'picking', computer: 'picking', picking: 'ready' };

const MINIMUM_PLAYERS = 2;
const COMPUTER_TEXT = ['', 'Ready players add', 'a computer with right'];
const COMPUTER_COLOR = '#8b9bb4';

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
    // Seeded from the real input on the first tick this scene runs, so a button still held from
    // the title screen's confirm press never counts as a fresh press here.
    this.menuInput = null;
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
    if (!this.menuInput) {
      this.menuInput = new MenuInput(inputByPlayerId);
      return;
    }

    // Each seat answers only to its own player's keys. Back with nobody joined leaves for the title.
    const pressesByPlayerId = this.menuInput.pressesByPlayerId(inputByPlayerId);
    for (const spawn of PLAYERS) {
      const presses = pressesByPlayerId[spawn.id];
      if (!presses) continue;
      const input = inputByPlayerId[spawn.id];
      if (this.stateByPlayerId[spawn.id] === 'picking') {
        if (presses.left) this.changeCharacter(spawn.id, -1);
        if (presses.right) this.changeCharacter(spawn.id, 1);
      } else if (this.stateByPlayerId[spawn.id] === 'ready') {
        if (presses.right) this.addComputer();
        if (presses.left) this.removeComputer();
      }
      if (presses.confirm) this.advance(spawn.id);
      else if (presses.back && this.nobodyJoined) {
        this.returnToTitle(inputByPlayerId);
        return;
      } else if (presses.back) this.stepBack(spawn.id);
    }

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
          computerPlayerIds: this.computerPlayerIds,
          sprites: this.sprites,
          seed: this.seed,
        }),
      );
    }
  }

  // The match starts once at least one person is ready, there are two fighters counting computers, and nobody who
  // joined is still picking. Players who never joined take no part.
  everyoneJoinedIsReady() {
    const states = Object.values(this.stateByPlayerId);
    const readyCount = states.filter((state) => state === 'ready').length;
    const computerCount = states.filter((state) => state === 'computer').length;
    return (
      readyCount >= 1 && readyCount + computerCount >= MINIMUM_PLAYERS && states.every((state) => state !== 'picking')
    );
  }

  get computerPlayerIds() {
    return PLAYERS.filter((spawn) => this.stateByPlayerId[spawn.id] === 'computer').map((spawn) => spawn.id);
  }

  // A ready player fills the first empty seat with a computer player, on the first character nobody has.
  addComputer() {
    const seatIndex = PLAYERS.findIndex((spawn) => this.stateByPlayerId[spawn.id] === 'unjoined');
    if (seatIndex < 0) return;
    const playerId = PLAYERS[seatIndex].id;
    this.characterIndexByPlayerId[playerId] = CHARACTERS.findIndex(
      (character, index) => !this.isLockedByOther(playerId, index),
    );
    this.stateByPlayerId[playerId] = 'computer';
    this.cardMotion.join(seatIndex);
    this.moveHoveringPlayersOff(playerId);
    this.events.emit('menu-selected', { playerId });
  }

  // A ready player empties the last seat a computer plays.
  removeComputer() {
    const playerId = this.computerPlayerIds.at(-1);
    if (!playerId) return;
    this.stateByPlayerId[playerId] = 'unjoined';
    this.characterIndexByPlayerId[playerId] = CHARACTERS.indexOf(HOVER_CHARACTER_BY_PLAYER_ID[playerId]);
    this.events.emit('menu-moved', { playerId });
  }

  get nobodyJoined() {
    return Object.values(this.stateByPlayerId).every((state) => state === 'unjoined');
  }

  returnToTitle(initialInput) {
    this.events.emit('menu-selected', {});
    this.sceneManager.setScene(
      new TitleScene({
        sceneManager: this.sceneManager,
        levels: this.levels,
        sprites: this.sprites,
        seed: this.seed,
        initialInput,
      }),
    );
  }

  // Shove steps back: a ready player goes back to picking, and a player who joined by mistake steps out,
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
        (this.stateByPlayerId[spawn.id] === 'ready' || this.stateByPlayerId[spawn.id] === 'computer') &&
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
      if (spawn.id === lockedPlayerId || ['ready', 'computer'].includes(this.stateByPlayerId[spawn.id])) continue;
      if (this.characterIndexByPlayerId[spawn.id] === this.characterIndexByPlayerId[lockedPlayerId]) {
        this.changeCharacter(spawn.id, 1);
      }
    }
  }

  // Only the ready players and the computer players, in seat order.
  pickedCharacters() {
    const characterByPlayerId = {};
    for (const spawn of PLAYERS) {
      if (['ready', 'computer'].includes(this.stateByPlayerId[spawn.id]))
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
    drawEmptySelectCard(context, box, spawn, [JOIN_TEXT_BY_PLAYER_ID[spawn.id], ...COMPUTER_TEXT], textScale);
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
    status: {
      ready: { text: 'READY!', color: SELECTED_COLOR },
      computer: { text: 'Computer', color: COMPUTER_COLOR },
      picking: { text: 'Not ready', color: NOT_READY_COLOR },
    }[state],
    textScale,
  });
  context.restore();
}

// Touch means a phone, where the card text is drawn at textScale 2 so it stays readable.
function drawPlayerSelectUi(context, scene, textScale) {
  drawMenuTitle(context, 'Player Select', TITLE_Y);
  for (const spawn of PLAYERS) drawPlayerCard(context, scene, spawn, textScale);
  drawKeyHintRows(context, KEY_HINT_ROWS, { topY: HINTS_TOP_Y, width: HINTS_WIDTH });
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
