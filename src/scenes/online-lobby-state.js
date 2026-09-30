import { SeededRandom } from '../engine/seeded-random.js';
import { CHARACTERS, HOVER_CHARACTER_BY_PLAYER_ID } from '../entities/characters.js';
import { PLAYERS } from '../levels/versus-arena.js';
import { MATCH_MODES } from './match-modes.js';
import { wrapMenuIndex } from '../ui/menu-kit.js';

export const MINIMUM_READY_PLAYERS = 2;
export const RANDOM_LEVEL = 'random';

// Who is in an online room and what they picked. The host owns one of these and sends `snapshot()` to
// everyone, so joiners keep a copy with `load()`. Members are told apart by any id the caller likes,
// such as 'host' or a peer id. Seat order is player order: seat 0 is red, then blue, green and yellow.
export class OnlineLobby {
  // `levelNames` are the levels the host can pick, in picker order. Random is always offered last.
  constructor({ levelNames }) {
    this.levelChoices = [...levelNames, RANDOM_LEVEL];
    this.levelName = RANDOM_LEVEL;
    this.modeId = MATCH_MODES[0].id;
    this.seats = PLAYERS.map(() => null);
  }

  seatOf(memberId) {
    return this.seats.findIndex((seat) => seat?.memberId === memberId);
  }

  get playerCount() {
    return this.seats.filter(Boolean).length;
  }

  get readyCount() {
    return this.seats.filter((seat) => seat?.ready).length;
  }

  // Takes the lowest free seat and returns its index, or -1 when the room is full.
  join(memberId) {
    const existingSeat = this.seatOf(memberId);
    if (existingSeat >= 0) return existingSeat;
    const seatIndex = this.seats.findIndex((seat) => seat === null);
    if (seatIndex < 0) return -1;
    this.seats[seatIndex] = { memberId, characterName: null, ready: false };
    this.seats[seatIndex].characterName = this.firstFreeCharacterName(seatIndex);
    return seatIndex;
  }

  leave(memberId) {
    const seatIndex = this.seatOf(memberId);
    if (seatIndex < 0) return false;
    this.seats[seatIndex] = null;
    return true;
  }

  isTakenByOther(seatIndex, characterName) {
    return this.seats.some((seat, index) => index !== seatIndex && seat?.characterName === characterName);
  }

  // A seat starts on its usual character, or the next free one when someone already has it.
  firstFreeCharacterName(seatIndex) {
    const preferred = HOVER_CHARACTER_BY_PLAYER_ID[PLAYERS[seatIndex].id].name;
    const startIndex = CHARACTERS.findIndex((character) => character.name === preferred);
    for (let step = 0; step < CHARACTERS.length; step++) {
      const { name } = CHARACTERS[(startIndex + step) % CHARACTERS.length];
      if (!this.isTakenByOther(seatIndex, name)) return name;
    }
    return preferred;
  }

  // Moves to the next character nobody else has. A ready player has to un-ready first.
  changeCharacter(memberId, direction) {
    const seatIndex = this.seatOf(memberId);
    const seat = this.seats[seatIndex];
    if (!seat || seat.ready) return false;
    const startIndex = CHARACTERS.findIndex((character) => character.name === seat.characterName);
    for (let step = 1; step <= CHARACTERS.length; step++) {
      const index = wrapMenuIndex(startIndex, direction * step, CHARACTERS.length);
      if (!this.isTakenByOther(seatIndex, CHARACTERS[index].name)) {
        seat.characterName = CHARACTERS[index].name;
        return true;
      }
    }
    return false;
  }

  setReady(memberId, ready) {
    const seat = this.seats[this.seatOf(memberId)];
    if (!seat) return false;
    seat.ready = ready;
    return true;
  }

  toggleReady(memberId) {
    const seat = this.seats[this.seatOf(memberId)];
    return seat ? this.setReady(memberId, !seat.ready) : false;
  }

  changeLevel(direction) {
    const count = this.levelChoices.length;
    const index = this.levelChoices.indexOf(this.levelName);
    this.levelName = this.levelChoices[(index + direction + count) % count];
  }

  changeMode(direction) {
    const index = MATCH_MODES.findIndex((mode) => mode.id === this.modeId);
    this.modeId = MATCH_MODES[wrapMenuIndex(index, direction, MATCH_MODES.length)].id;
  }

  // A match needs two ready players and nobody left out: everyone in the room plays.
  canStart() {
    return this.readyCount >= MINIMUM_READY_PLAYERS && this.readyCount === this.playerCount;
  }

  // What the host broadcasts when the match starts. Random turns into one level here, drawn from the seed.
  matchSetup(seed) {
    let levelName = this.levelName;
    if (levelName === RANDOM_LEVEL) {
      const levelNames = this.levelChoices.slice(0, -1);
      levelName = levelNames[Math.floor(new SeededRandom(seed).next() * levelNames.length)];
    }
    const players = [];
    this.seats.forEach((seat, seatIndex) => {
      if (seat) players.push({ id: PLAYERS[seatIndex].id, characterName: seat.characterName });
    });
    return { seed, levelName, mode: this.modeId, players };
  }

  // The player id that each member plays, for the members who are seated.
  playerIdByMemberId() {
    const playerIdByMemberId = {};
    this.seats.forEach((seat, seatIndex) => {
      if (seat) playerIdByMemberId[seat.memberId] = PLAYERS[seatIndex].id;
    });
    return playerIdByMemberId;
  }

  // Plain data without member ids, safe to send to every device.
  snapshot() {
    return {
      levelName: this.levelName,
      modeId: this.modeId,
      seats: this.seats.map((seat) => seat && { characterName: seat.characterName, ready: seat.ready }),
    };
  }

  load(snapshot) {
    this.levelName = this.levelChoices.includes(snapshot?.levelName) ? snapshot.levelName : RANDOM_LEVEL;
    this.modeId = MATCH_MODES.some((mode) => mode.id === snapshot?.modeId) ? snapshot.modeId : MATCH_MODES[0].id;
    this.seats = PLAYERS.map((_, seatIndex) => {
      const seat = snapshot?.seats?.[seatIndex];
      const isKnownCharacter = CHARACTERS.some((character) => character.name === seat?.characterName);
      return seat && isKnownCharacter ? { characterName: seat.characterName, ready: seat.ready === true } : null;
    });
  }
}
