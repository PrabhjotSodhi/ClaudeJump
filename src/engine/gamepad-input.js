// Gamepad state only. Game logic reads the sampled records, never the gamepad.
const STICK_DEAD_ZONE = 0.35;

// A jumps and confirms menus. B or the right trigger is the action, and B alone goes back in menus. Stick or d-pad
// up and down only move menu selections, so a diagonal while running never shoves.
const BUTTON_JUMP = 0; // A
const BUTTON_ACTION = 1; // B
const BUTTON_ACTION_TRIGGER = 7; // right trigger
const BUTTON_PAUSE = 9; // Start
const BUTTON_DPAD_UP = 12;
const BUTTON_DPAD_DOWN = 13;
const BUTTON_DPAD_LEFT = 14;
const BUTTON_DPAD_RIGHT = 15;

const AXIS_STICK_X = 0;
const AXIS_STICK_Y = 1;

function isButtonPressed(gamepad, buttonIndex) {
  return gamepad.buttons[buttonIndex]?.pressed ?? false;
}

export function mapGamepadToInput(gamepad) {
  if (!gamepad) {
    return {
      left: false,
      right: false,
      jump: false,
      up: false,
      down: false,
      action: false,
      confirm: false,
      back: false,
      pause: false,
    };
  }

  const stickX = gamepad.axes[AXIS_STICK_X] ?? 0;
  const stickY = gamepad.axes[AXIS_STICK_Y] ?? 0;

  return {
    left: stickX < -STICK_DEAD_ZONE || isButtonPressed(gamepad, BUTTON_DPAD_LEFT),
    right: stickX > STICK_DEAD_ZONE || isButtonPressed(gamepad, BUTTON_DPAD_RIGHT),
    jump: isButtonPressed(gamepad, BUTTON_JUMP),
    down: stickY > STICK_DEAD_ZONE || isButtonPressed(gamepad, BUTTON_DPAD_DOWN),
    up: stickY < -STICK_DEAD_ZONE || isButtonPressed(gamepad, BUTTON_DPAD_UP),
    action: isButtonPressed(gamepad, BUTTON_ACTION) || isButtonPressed(gamepad, BUTTON_ACTION_TRIGGER),
    confirm: isButtonPressed(gamepad, BUTTON_JUMP),
    back: isButtonPressed(gamepad, BUTTON_ACTION),
    pause: isButtonPressed(gamepad, BUTTON_PAUSE),
  };
}

// Assigns gamepads to players by browser slot: the pad at gamepads[0] to the
// first player id, gamepads[1] to the second, and so on. The browser refills
// the lowest free slot on reconnect, so a replugged pad returns to the same
// player instead of shifting another player's pad over.
export function mapGamepadsToInputs(gamepads, playerIds) {
  const inputByPlayerId = {};
  playerIds.forEach((playerId, index) => {
    inputByPlayerId[playerId] = mapGamepadToInput(gamepads[index] ?? null);
  });
  return inputByPlayerId;
}

export function createGamepadInput(playerIds) {
  return {
    sample() {
      return mapGamepadsToInputs(navigator.getGamepads(), playerIds);
    },
  };
}
