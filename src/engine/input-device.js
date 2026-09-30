// The device that last sent input, for showing the right button hints. Only the UI reads it.
// Game state never does, so the game stays the same on every machine.
let currentDevice = 'keyboard';
let currentPadType = 'generic';

export function getInputDevice() {
  return currentDevice;
}

export function setInputDevice(device) {
  currentDevice = device;
}

// The face button symbols of the last pad that sent input: 'letters', 'shapes' or 'generic'.
export function getPadType() {
  return currentPadType;
}

export function setPadType(padType) {
  currentPadType = padType;
}

// A held pad button or key wins over touch, because touch hides itself when either is used.
// With nothing held, the device stays as it was.
export function pickInputDevice(previousDevice, { keyboardHeld, padHeld, touchVisible }) {
  if (padHeld) return 'pad';
  if (keyboardHeld) return 'keyboard';
  if (touchVisible) return 'touch';
  return previousDevice;
}

const SHAPES_PAD_PATTERN = /054c|playstation|dualshock|dualsense/i;
const LETTERS_PAD_PATTERN = /045e|xbox|xinput/i;

// Which symbols a pad prints on its face buttons, from the id string the browser reports.
// Pads that put their letters in other places fall back to 'generic', which shows positions only.
export function padTypeFromId(id) {
  if (SHAPES_PAD_PATTERN.test(id)) return 'shapes';
  if (LETTERS_PAD_PATTERN.test(id)) return 'letters';
  return 'generic';
}
