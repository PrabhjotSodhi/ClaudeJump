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

// A control counts as pressed if either source pressed it.
export function combineInputs(inputByPlayerIdA, inputByPlayerIdB) {
  const inputByPlayerId = {};
  for (const playerId in inputByPlayerIdA) {
    const inputA = inputByPlayerIdA[playerId];
    const inputB = inputByPlayerIdB[playerId] ?? {};
    inputByPlayerId[playerId] = {
      left: inputA.left || !!inputB.left,
      right: inputA.right || !!inputB.right,
      jump: inputA.jump || !!inputB.jump,
      up: inputA.up || !!inputB.up,
      down: inputA.down || !!inputB.down,
      action: inputA.action || !!inputB.action,
      confirm: inputA.confirm || !!inputB.confirm,
      pause: inputA.pause || !!inputB.pause,
    };
  }
  return inputByPlayerId;
}
