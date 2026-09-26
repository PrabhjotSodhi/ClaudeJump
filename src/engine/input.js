// Keyboard state only. Game logic reads the sampled records, never the keyboard.
export function createKeyboardInput(playerKeyMappings) {
  const heldCodes = new Set();
  // A tap shorter than one tick still counts for the next sample.
  const tappedCodes = new Set();
  const trackedCodes = new Set(playerKeyMappings.flatMap((mapping) => Object.values(mapping.keys)));

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
          card: isDown(mapping.keys.card),
        };
      }
      tappedCodes.clear();
      return inputByPlayerId;
    },
  };
}
