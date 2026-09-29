import { drawPauseMenu } from '../ui/pause-menu.js';
import { TitleScene } from './title-scene.js';

export const PAUSE_MENU_OPTIONS = [
  { id: 'resume', label: 'Resume' },
  { id: 'title', label: 'Return to title' },
];

// Controls masked out of the match's input for a player until they release it, so confirming
// Resume (or toggling pause) with one of these still held does not act on the match the instant
// it resumes: a held jump would launch the player, a held action button would fire a shove, and so on.
const CONTROLS_MASKED_ON_RESUME = ['jump', 'down', 'action'];

// Wraps a match scene so pausing never calls its update(), which keeps the match's own game
// logic unaware that wall-clock time passed. The wrapper reads input to navigate the pause menu,
// but nothing here changes match state directly except handing control back to it on resume.
export class PausableMatchScene {
  constructor({ sceneManager, matchScene }) {
    this.sceneManager = sceneManager;
    this.matchScene = matchScene;
    this.paused = false;
    this.selectedIndex = 0;
    this.previousPauseByPlayerId = {};
    this.previousDownByPlayerId = {};
    this.previousJumpByPlayerId = {};
  }

  get waterLineY() {
    return this.matchScene.waterLineY;
  }

  update(inputByPlayerId) {
    const pausePressed = this.consumeFreshPress(inputByPlayerId, 'pause', this.previousPauseByPlayerId);

    if (this.paused) {
      if (pausePressed) {
        this.resume(inputByPlayerId);
        return;
      }
      this.updateMenu(inputByPlayerId);
      return;
    }

    if (pausePressed) {
      this.openMenu(inputByPlayerId);
      return;
    }

    this.matchScene.update(this.maskHeldOnResume(inputByPlayerId));
  }

  updateMenu(inputByPlayerId) {
    const downPressed = this.consumeFreshPress(inputByPlayerId, 'down', this.previousDownByPlayerId);
    const jumpPressed = this.consumeFreshPress(inputByPlayerId, 'jump', this.previousJumpByPlayerId);

    if (downPressed) this.selectedIndex = (this.selectedIndex + 1) % PAUSE_MENU_OPTIONS.length;
    if (jumpPressed) this.confirmSelection(inputByPlayerId);
  }

  // A control counts as freshly pressed the tick it goes from not held by any player to held by
  // at least one, so either player can drive the menu and a tap shorter than a tick still lands.
  consumeFreshPress(inputByPlayerId, controlName, previousByPlayerId) {
    let pressed = false;
    for (const playerId in inputByPlayerId) {
      const isDown = !!inputByPlayerId[playerId][controlName];
      if (isDown && !previousByPlayerId[playerId]) pressed = true;
      previousByPlayerId[playerId] = isDown;
    }
    return pressed;
  }

  // Seeds the menu's held-key baseline from whatever is held right now, so a down or jump press
  // still held from the match does not immediately move the selection or confirm an option.
  openMenu(inputByPlayerId) {
    this.paused = true;
    this.selectedIndex = 0;
    this.previousDownByPlayerId = {};
    this.previousJumpByPlayerId = {};
    for (const playerId in inputByPlayerId) {
      this.previousDownByPlayerId[playerId] = !!inputByPlayerId[playerId].down;
      this.previousJumpByPlayerId[playerId] = !!inputByPlayerId[playerId].jump;
    }
  }

  // Losing window focus pauses the match the same way a fresh pause press does.
  pauseForFocusLoss(inputByPlayerId = {}) {
    if (!this.paused) this.openMenu(inputByPlayerId);
  }

  // Records which of the masked controls each player is holding right now, so the match ignores
  // exactly those controls for exactly that player until they let go and press again.
  resume(inputByPlayerId = {}) {
    this.paused = false;
    this.heldOnResumeByPlayerId = {};
    for (const playerId in inputByPlayerId) {
      const input = inputByPlayerId[playerId];
      const held = {};
      for (const control of CONTROLS_MASKED_ON_RESUME) held[control] = !!input[control];
      this.heldOnResumeByPlayerId[playerId] = held;
    }
  }

  maskHeldOnResume(inputByPlayerId) {
    if (!this.heldOnResumeByPlayerId) return inputByPlayerId;

    const maskedInput = {};
    for (const playerId in inputByPlayerId) {
      const input = inputByPlayerId[playerId];
      const held = this.heldOnResumeByPlayerId[playerId];
      if (!held) {
        maskedInput[playerId] = input;
        continue;
      }
      const maskedForPlayer = { ...input };
      for (const control of CONTROLS_MASKED_ON_RESUME) {
        if (!held[control]) continue;
        if (input[control]) maskedForPlayer[control] = false;
        else held[control] = false;
      }
      maskedInput[playerId] = maskedForPlayer;
    }
    return maskedInput;
  }

  confirmSelection(inputByPlayerId) {
    const option = PAUSE_MENU_OPTIONS[this.selectedIndex];
    if (option.id === 'resume') {
      this.resume(inputByPlayerId);
    } else if (option.id === 'title') {
      const seed = Math.floor(this.matchScene.random.next() * 0xffffffff);
      this.sceneManager.setScene(
        new TitleScene({
          sceneManager: this.sceneManager,
          level: this.matchScene.level,
          seed,
          initialInput: inputByPlayerId,
        }),
      );
    }
  }

  render(renderer) {
    this.matchScene.render(renderer);
    if (this.paused)
      drawPauseMenu(renderer.uiContext, { options: PAUSE_MENU_OPTIONS, selectedIndex: this.selectedIndex });
  }
}
