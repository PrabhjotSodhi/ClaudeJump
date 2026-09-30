// Keyboard state only. Game logic reads the sampled records, never the keyboard.
// These keys press `confirm` for every player, so menus confirm with a key no match control uses.
const CONFIRM_KEY_CODES = ['Enter', 'Space'];

export function createKeyboardInput(playerKeyMappings) {
  const heldCodes = new Set();
  // A tap shorter than one tick still counts for the next sample.
  const tappedCodes = new Set();
  const trackedCodes = new Set([
    ...playerKeyMappings.flatMap((mapping) => Object.values(mapping.keys)),
    ...CONFIRM_KEY_CODES,
  ]);

  function handleKeyDown(event) {
    if (!trackedCodes.has(event.code)) return;
    event.preventDefault();
    if (event.repeat) return;
    heldCodes.add(event.code);
    tappedCodes.add(event.code);
  }

  function handleKeyUp(event) {
    heldCodes.delete(event.code);
  }

  function handleBlur() {
    heldCodes.clear();
  }

  addEventListener('keydown', handleKeyDown);
  addEventListener('keyup', handleKeyUp);
  addEventListener('blur', handleBlur);

  function isDown(code) {
    return heldCodes.has(code) || tappedCodes.has(code);
  }

  return {
    sample() {
      const inputByPlayerId = {};
      for (const mapping of playerKeyMappings) {
        inputByPlayerId[mapping.id] = {
          left: isDown(mapping.keys.left),
          right: isDown(mapping.keys.right),
          jump: isDown(mapping.keys.jump),
          up: isDown(mapping.keys.up),
          down: isDown(mapping.keys.down),
          action: isDown(mapping.keys.action),
          confirm: CONFIRM_KEY_CODES.some(isDown),
          pause: isDown(mapping.keys.pause),
        };
      }
      tappedCodes.clear();
      return inputByPlayerId;
    },
  };
}

const CONTROLS = ['left', 'right', 'jump', 'up', 'down', 'action', 'confirm', 'pause'];

// A control counts as pressed if any source pressed it. A tap is the first source's tap point.
// A player that only some sources know, such as a gamepad-only seat, is still combined.
export function combineInputs(...inputByPlayerIdSources) {
  const playerIds = new Set(inputByPlayerIdSources.flatMap((source) => Object.keys(source)));
  const inputByPlayerId = {};
  for (const playerId of playerIds) {
    const inputs = inputByPlayerIdSources.map((source) => source[playerId] ?? {});
    inputByPlayerId[playerId] = { tap: inputs.find((input) => input.tap)?.tap ?? null };
    for (const control of CONTROLS) inputByPlayerId[playerId][control] = inputs.some((input) => !!input[control]);
  }
  return inputByPlayerId;
}

// One device plays one online player. Every local control drives that player: either keyboard side, pad 1 and touch.
export function mergeLocalInputs(inputByPlayerId) {
  return combineInputs({ local: {} }, ...Object.values(inputByPlayerId).map((input) => ({ local: input }))).local;
}
