// The device that last sent input, for showing the right button hints. Only the UI reads it.
// Game state never does, so the game stays the same on every machine.
let currentDevice = 'keyboard';

export function getInputDevice() {
  return currentDevice;
}

export function setInputDevice(device) {
  currentDevice = device;
}

// A held pad button or key wins over touch, because touch hides itself when either is used.
// With nothing held, the device stays as it was.
export function pickInputDevice(previousDevice, { keyboardHeld, padHeld, touchVisible }) {
  if (padHeld) return 'pad';
  if (keyboardHeld) return 'keyboard';
  if (touchVisible) return 'touch';
  return previousDevice;
}
