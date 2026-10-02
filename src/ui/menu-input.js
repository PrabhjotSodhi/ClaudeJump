const CONTROLS = ['left', 'right', 'up', 'down', 'jump', 'action', 'confirm', 'pause'];

// The one way every menu is driven, the same on every device. Left and right move. Up and down move too where they
// are buttons of their own, like a pad's stick and d-pad; on a keyboard they are the jump and shove keys, and on touch
// there is no down. Jump confirms, as do Enter and pad A. Shove goes back, as do Escape and pad B.
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

  // Each player's fresh presses this tick: { previous, next, left, right, up, down, confirm, back }. Left, right, up and
  // down are for screens that move in two directions or only sideways. Call once per tick.
  pressesByPlayerId(inputByPlayerId) {
    const pressesByPlayerId = {};
    for (const playerId in inputByPlayerId) {
      const input = inputByPlayerId[playerId] ?? {};
      const held = this.heldByPlayerId[playerId] ?? {};
      const fresh = (control) => !!input[control] && !held[control];
      pressesByPlayerId[playerId] = {
        previous: fresh('left') || (fresh('up') && !input.jump),
        next: fresh('right') || (fresh('down') && !input.action),
        left: fresh('left'),
        right: fresh('right'),
        up: fresh('up') && !input.jump,
        down: fresh('down') && !input.action,
        confirm: fresh('jump') || fresh('confirm'),
        back: fresh('action') || fresh('pause'),
      };
    }
    // A player missing from this tick's input holds nothing.
    this.heldByPlayerId = {};
    this.hold(inputByPlayerId);
    return pressesByPlayerId;
  }

  // Everyone's fresh presses this tick, merged, for a menu any player can drive. Call once per tick.
  presses(inputByPlayerId) {
    const merged = {
      previous: false,
      next: false,
      left: false,
      right: false,
      up: false,
      down: false,
      confirm: false,
      back: false,
    };
    for (const presses of Object.values(this.pressesByPlayerId(inputByPlayerId))) {
      for (const name in merged) merged[name] ||= presses[name];
    }
    return merged;
  }
}

// -1, 0 or 1: which way the presses move a selection.
export function menuStep(presses) {
  return (presses.next ? 1 : 0) - (presses.previous ? 1 : 0);
}
