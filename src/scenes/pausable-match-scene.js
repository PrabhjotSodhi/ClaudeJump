import { saveKeyBindings } from '../engine/key-bindings.js';
import { saveSettings, settings } from '../engine/sound-settings.js';
import { AwardReveal } from '../ui/award-reveal.js';
import { pickAwards } from '../ui/match-stats.js';
import { MenuMotion, wrapMenuIndex } from '../ui/menu-kit.js';
import { MenuInput, menuStep } from '../ui/menu-input.js';
import { drawPauseMenu } from '../ui/pause-menu.js';
import { SettingsMenu } from '../ui/settings-menu.js';
import { drawResultsMenu } from '../ui/results-menu.js';
import { LevelSelectScene } from './level-select-scene.js';
import { PlayerSelectScene } from './player-select-scene.js';
import { TitleScene } from './title-scene.js';

// The fullscreen row shows the current setting, so the list is built fresh each time it is used.
function pauseMenuOptions(fullscreen) {
  const options = [
    { id: 'resume', label: 'Resume' },
    { id: 'title', label: 'Return to title' },
    { id: 'settings', label: 'Settings' },
  ];
  if (fullscreen?.supported)
    options.push({ id: 'fullscreen', label: fullscreen.active ? 'Fullscreen: On' : 'Fullscreen: Off' });
  return options;
}

export const RESULTS_MENU_OPTIONS = [
  { id: 'rematch', label: 'Rematch' },
  { id: 'level', label: 'Change level' },
  { id: 'characters', label: 'Change characters' },
];

// Controls masked out of the match's input for a player until they release it, so confirming
// Resume (or toggling pause) with one of these still held does not act on the match the instant
// it resumes: a held jump would launch the player, a held action button would fire a shove, and so on.
const CONTROLS_MASKED_ON_RESUME = ['up', 'down', 'jump', 'action', 'confirm'];

// Wraps a match scene so pausing never calls its update(), which keeps the match's own game
// logic unaware that wall-clock time passed. The wrapper reads input to navigate the pause menu,
// but nothing here changes match state directly except handing control back to it on resume.
export class PausableMatchScene {
  constructor({ sceneManager, matchScene }) {
    this.sceneManager = sceneManager;
    this.matchScene = matchScene;
    // Menu sounds ride on the match's events so one sound player hears both.
    this.events = matchScene.events;
    this.musicTrackName = 'match';
    this.paused = false;
    this.selectedIndex = 0;
    this.previousPauseByPlayerId = {};
    this.menuInput = new MenuInput();
    this.resultsMenuOpen = false;
    this.resultsSelectedIndex = 0;
    this.awardReveal = null;
    this.settingsMenu = null;
    this.pauseMotion = new MenuMotion({ closed: true });
    this.resultsMotion = new MenuMotion();
  }

  get pauseMenuOptions() {
    return pauseMenuOptions(this.sceneManager.fullscreen);
  }

  get waterLineY() {
    return this.matchScene.waterLineY;
  }

  get showingResults() {
    return this.matchScene.phase === 'match' && this.matchScene.ticksRemaining <= 0;
  }

  update(inputByPlayerId) {
    this.pauseMotion.update();
    this.resultsMotion.update();
    const pausePressed = this.consumeFreshPress(inputByPlayerId, 'pause', this.previousPauseByPlayerId);

    if (!this.paused && this.showingResults) {
      this.matchScene.update(inputByPlayerId);
      this.updateResultsMenu(inputByPlayerId);
      return;
    }
    this.resultsMenuOpen = false;

    if (this.paused) {
      if (this.settingsMenu) {
        if (this.settingsMenu.update(inputByPlayerId)) {
          this.settingsMenu = null;
          this.menuInput.hold(inputByPlayerId);
        }
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

  // Back resumes, like the pause button that opened the menu.
  updateMenu(inputByPlayerId) {
    const presses = this.menuInput.presses(inputByPlayerId);
    if (presses.back) {
      this.resume(inputByPlayerId);
      return;
    }
    const step = menuStep(presses);
    if (step !== 0) {
      this.selectedIndex = wrapMenuIndex(this.selectedIndex, step, this.pauseMenuOptions.length);
      this.events.emit('menu-moved', {});
    }
    if (presses.confirm) {
      this.events.emit('menu-selected', {});
      this.pauseMotion.press();
      this.confirmSelection(inputByPlayerId);
    }
  }

  // The first tick the results show only records what is held, so the jump that ended the last
  // round never confirms an option. The match keeps ticking underneath so the sinking player finishes falling.
  updateResultsMenu(inputByPlayerId) {
    if (!this.resultsMenuOpen) {
      this.resultsMenuOpen = true;
      this.resultsSelectedIndex = 0;
      this.resultsMotion = new MenuMotion();
      this.awardReveal = new AwardReveal(
        pickAwards(
          this.matchScene.matchStats,
          this.matchScene.players.map((player) => player.id),
        ),
        this.events,
      );
      this.menuInput.hold(inputByPlayerId);
      return;
    }
    this.awardReveal.update();

    const presses = this.menuInput.presses(inputByPlayerId);
    const step = menuStep(presses);
    if (step !== 0) {
      this.resultsSelectedIndex = wrapMenuIndex(this.resultsSelectedIndex, step, RESULTS_MENU_OPTIONS.length);
      this.events.emit('menu-moved', {});
    }
    if (presses.confirm) {
      this.events.emit('menu-selected', {});
      this.resultsMotion.press();
      this.confirmResultsOption(inputByPlayerId);
    }
  }

  confirmResultsOption(inputByPlayerId) {
    const optionId = RESULTS_MENU_OPTIONS[this.resultsSelectedIndex].id;
    if (optionId === 'rematch') {
      this.matchScene.startNewMatch();
    } else if (optionId === 'level') {
      this.sceneManager.setScene(
        new LevelSelectScene({
          sceneManager: this.sceneManager,
          levels: this.matchScene.levels,
          characterByPlayerId: this.matchScene.characterByPlayerId,
          sprites: this.matchScene.sprites,
          seed: this.nextSeed(),
          mode: this.matchScene.mode,
        }),
      );
    } else if (optionId === 'characters') {
      this.sceneManager.setScene(
        new PlayerSelectScene({
          sceneManager: this.sceneManager,
          levels: this.matchScene.levels,
          sprites: this.matchScene.sprites,
          seed: this.nextSeed(),
        }),
      );
    }
  }

  nextSeed() {
    return Math.floor(this.matchScene.random.next() * 0xffffffff);
  }

  // A control counts as freshly pressed the tick it goes from not held by any player to held by
  // at least one, so either player can open the menu.
  consumeFreshPress(inputByPlayerId, controlName, previousByPlayerId) {
    let pressed = false;
    for (const playerId in inputByPlayerId) {
      const isDown = !!inputByPlayerId[playerId][controlName];
      if (isDown && !previousByPlayerId[playerId]) pressed = true;
      previousByPlayerId[playerId] = isDown;
    }
    return pressed;
  }

  // Seeds the menu's held-key baseline from whatever is held right now, so a press still held from the match, like
  // the pause press itself, does not immediately act on the menu.
  openMenu(inputByPlayerId) {
    this.paused = true;
    this.selectedIndex = 0;
    this.pauseMotion = new MenuMotion();
    this.menuInput.hold(inputByPlayerId);
  }

  // Losing window focus pauses the match the same way a fresh pause press does.
  pauseForFocusLoss(inputByPlayerId = {}) {
    if (!this.paused) this.openMenu(inputByPlayerId);
  }

  // Records which of the masked controls each player is holding right now, so the match ignores
  // exactly those controls for exactly that player until they let go and press again.
  resume(inputByPlayerId = {}) {
    this.paused = false;
    this.pauseMotion.close();
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

  saveSettings() {
    const storage = this.sceneManager.soundPlayer?.storage;
    if (!storage) return;
    saveSettings(storage, settings);
    saveKeyBindings(storage);
  }

  confirmSelection(inputByPlayerId) {
    const option = this.pauseMenuOptions[this.selectedIndex];
    if (option.id === 'resume') {
      this.resume(inputByPlayerId);
    } else if (option.id === 'settings') {
      this.settingsMenu = new SettingsMenu({
        settings,
        events: this.events,
        onChange: () => this.saveSettings(),
        initialInput: inputByPlayerId,
      });
    } else if (option.id === 'fullscreen') {
      this.sceneManager.fullscreen.toggle();
    } else if (option.id === 'title') {
      this.sceneManager.setScene(
        new TitleScene({
          sceneManager: this.sceneManager,
          levels: this.matchScene.levels,
          sprites: this.matchScene.sprites,
          seed: this.nextSeed(),
          initialInput: inputByPlayerId,
        }),
      );
    }
  }

  render(renderer) {
    this.matchScene.render(renderer);
    if (!this.paused && this.showingResults)
      drawResultsMenu(renderer.uiContext, {
        matchScene: this.matchScene,
        options: RESULTS_MENU_OPTIONS,
        selectedIndex: this.resultsSelectedIndex,
        motion: this.resultsMotion,
        awardReveal: this.awardReveal,
      });
    if (!this.settingsMenu && (this.paused || !this.pauseMotion.isClosed)) {
      drawPauseMenu(renderer.uiContext, {
        options: this.pauseMenuOptions,
        selectedIndex: this.selectedIndex,
        motion: this.pauseMotion,
      });
    }
    this.settingsMenu?.render(renderer.uiContext);
  }
}
