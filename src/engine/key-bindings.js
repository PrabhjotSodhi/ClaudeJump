// The keyboard keys of each player, as key codes. main.js fills the one live copy from
// data/config/key-mappings.json, the Controls screen changes it and input.js reads it.
// Only these controls can be remapped. Jump also drives menu up and action also drives menu down.
export const REMAPPABLE_CONTROLS = ['left', 'right', 'jump', 'action'];
const PAUSE_CODE = 'Escape';
// Menus confirm with these for every player.
const RESERVED_CODES = ['Enter', 'Space'];
const STORAGE_KEY = 'claudejump-key-bindings';

export const keyBindings = { mappings: [], defaults: [] };

export function initKeyBindings(mappings) {
  keyBindings.mappings = mappings;
  keyBindings.defaults = structuredClone(mappings);
}

// The Controls screen waits for one key press. input.js hands it the next key instead of
// treating it as a control, and the screen takes it on its next tick.
export const keyCapture = {
  waiting: false,
  code: null,
  start() {
    this.waiting = true;
    this.code = null;
  },
  stop() {
    this.waiting = false;
    this.code = null;
  },
  take() {
    const code = this.code;
    this.code = null;
    return code;
  },
};

export function boundCode(playerId, control) {
  return keyBindings.mappings.find((mapping) => mapping.id === playerId)?.keys[control];
}

// The short name a keycap shows for a key code.
export function keyName(code) {
  if (!code) return '?';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  if (code === 'Escape') return 'Esc';
  return code;
}

function playerLabel(playerId) {
  return playerId[0].toUpperCase() + playerId.slice(1);
}

function setKey(keys, control, code) {
  keys[control] = code;
  if (control === 'jump') keys.up = code;
  if (control === 'action') keys.down = code;
}

// Gives the control the key. A key that another control already uses, that opens pause or that
// menus confirm with is refused and nothing changes. Returns { ok: true } or { ok: false, message }.
export function assignKey(playerId, control, code) {
  if (code === PAUSE_CODE) return { ok: false, message: 'Esc always opens pause' };
  if (RESERVED_CODES.includes(code)) return { ok: false, message: `${keyName(code)} is used by menus` };
  for (const mapping of keyBindings.mappings) {
    for (const otherControl of REMAPPABLE_CONTROLS) {
      if (mapping.id === playerId && otherControl === control) continue;
      if (mapping.keys[otherControl] === code) {
        return { ok: false, message: `${keyName(code)} is already ${playerLabel(mapping.id)} ${otherControl}` };
      }
    }
  }
  setKey(keyBindings.mappings.find((mapping) => mapping.id === playerId).keys, control, code);
  return { ok: true };
}

export function resetKeyBindings() {
  for (const mapping of keyBindings.mappings) {
    const defaultKeys = keyBindings.defaults.find((defaults) => defaults.id === mapping.id).keys;
    Object.assign(mapping.keys, defaultKeys);
  }
}

export function saveKeyBindings(storage) {
  const saved = {};
  for (const mapping of keyBindings.mappings) {
    saved[mapping.id] = Object.fromEntries(REMAPPABLE_CONTROLS.map((control) => [control, mapping.keys[control]]));
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // The keys just are not remembered.
  }
}

// Anything missing, unreadable or clashing leaves every key at its default.
export function loadKeyBindings(storage) {
  let saved;
  try {
    saved = JSON.parse(storage.getItem(STORAGE_KEY));
  } catch {
    return;
  }
  if (!saved || typeof saved !== 'object') return;
  for (const mapping of keyBindings.mappings) {
    for (const control of REMAPPABLE_CONTROLS) setKey(mapping.keys, control, null);
  }
  for (const mapping of keyBindings.mappings) {
    for (const control of REMAPPABLE_CONTROLS) {
      const code = saved[mapping.id]?.[control];
      if (typeof code !== 'string' || !assignKey(mapping.id, control, code).ok) {
        resetKeyBindings();
        return;
      }
    }
  }
}
