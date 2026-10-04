const CONTROLS = ['left', 'right', 'up', 'down', 'jump', 'action', 'confirm', 'back', 'pause'];

// Menus read input two ways. A shared menu, which anyone drives, moves with any direction and confirms and goes back
// with the menu keys: Enter or Space and Escape or Backspace on a keyboard, A and B on a pad, jump and shove on touch.
// Pause goes back too, so the button that opened a menu closes it.
// A screen where each player has a seat reads each player on their own: left and right pick, jump joins or votes and
// shove steps back, and the menu keys work too for the player they belong to.
export class MenuInput {
  // initialInput is what is held as the menu opens, so a press held over from the screen before does not count here.
  constructor(initialInput = {}) {
    this.heldByPlayerId = {};
    this.hold(initialInput);
  }

  // Treats everything held right now as already pressed, so it only counts again after a release.
  hold(inputByPlayerId) {
    for (const playerId in inputByPlayerId) {
      const input = inputByPlayerId[playerId] ?? {};
      this.heldByPlayerId[playerId] = Object.fromEntries(CONTROLS.map((control) => [control, !!input[control]]));
    }
  }

  // Each player's fresh controls this tick, as { control: true }. Call once per tick.
  freshByPlayerId(inputByPlayerId) {
    const freshByPlayerId = {};
    for (const playerId in inputByPlayerId) {
      const input = inputByPlayerId[playerId] ?? {};
      const held = this.heldByPlayerId[playerId] ?? {};
      freshByPlayerId[playerId] = Object.fromEntries(
        CONTROLS.map((control) => [control, !!input[control] && !held[control]]),
      );
    }
    // A player missing from this tick's input holds nothing.
    this.heldByPlayerId = {};
    this.hold(inputByPlayerId);
    return freshByPlayerId;
  }

  // Each seated player's presses this tick: { left, right, confirm, back }. Call once per tick.
  pressesByPlayerId(inputByPlayerId) {
    const pressesByPlayerId = {};
    for (const [playerId, fresh] of Object.entries(this.freshByPlayerId(inputByPlayerId))) {
      pressesByPlayerId[playerId] = {
        left: fresh.left,
        right: fresh.right,
        confirm: fresh.jump || fresh.confirm,
        back: fresh.action || fresh.back,
      };
    }
    return pressesByPlayerId;
  }

  // Everyone's presses this tick for a shared menu: { previous, next, left, right, up, down, confirm, back }. Call once
  // per tick.
  presses(inputByPlayerId) {
    const merged = {
      left: false,
      right: false,
      up: false,
      down: false,
      confirm: false,
      back: false,
    };
    for (const fresh of Object.values(this.freshByPlayerId(inputByPlayerId))) {
      for (const name in merged) merged[name] ||= fresh[name];
      merged.back ||= fresh.pause;
    }
    return { ...merged, previous: merged.left || merged.up, next: merged.right || merged.down };
  }
}

// -1, 0 or 1: which way the presses move a selection.
export function menuStep(presses) {
  return (presses.next ? 1 : 0) - (presses.previous ? 1 : 0);
}
