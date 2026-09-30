const STORAGE_KEY = 'claudejump-sound-enabled';

// Storage can be missing or throw (private windows, blocked site data), so sound defaults to on.
export function loadSoundEnabled(storage) {
  try {
    return storage.getItem(STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function saveSoundEnabled(storage, soundEnabled) {
  try {
    storage.setItem(STORAGE_KEY, String(soundEnabled));
  } catch {
    // The choice just is not remembered.
  }
}

const MUSIC_STORAGE_KEY = 'claudejump-music-enabled';

export function loadMusicEnabled(storage) {
  try {
    return storage.getItem(MUSIC_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function saveMusicEnabled(storage, musicEnabled) {
  try {
    storage.setItem(MUSIC_STORAGE_KEY, String(musicEnabled));
  } catch {
    // The choice just is not remembered.
  }
}

// Display and audio settings the player picks in the Settings screen. The effects that use them
// (sounds, music, screen shake, flashes) only read this; game logic never does.
// Volumes are whole steps from 0 to VOLUME_STEPS.
export const VOLUME_STEPS = 10;
export const SCREEN_SHAKE_LEVELS = ['off', 'low', 'full'];
const SCREEN_SHAKE_SCALE = { off: 0, low: 0.5, full: 1 };
// How strong a flash is drawn when Reduce flashes is on.
const REDUCED_FLASH_STRENGTH = 0.35;

const SETTING_KEYS = {
  musicVolume: 'claudejump-music-volume',
  effectsVolume: 'claudejump-effects-volume',
  screenShake: 'claudejump-screen-shake',
  reduceFlashes: 'claudejump-reduce-flashes',
};

export function defaultSettings() {
  return { musicVolume: VOLUME_STEPS, effectsVolume: VOLUME_STEPS, screenShake: 'full', reduceFlashes: false };
}

// The one live copy, filled from storage when the game starts and changed by the Settings screen.
export const settings = defaultSettings();

function readVolume(storage, key) {
  const stored = storage.getItem(key);
  const steps = stored === null ? NaN : Number(stored);
  return Number.isInteger(steps) && steps >= 0 && steps <= VOLUME_STEPS ? steps : VOLUME_STEPS;
}

// Anything missing, unreadable or invalid falls back to its default.
export function loadSettings(storage) {
  const loaded = defaultSettings();
  try {
    loaded.musicVolume = readVolume(storage, SETTING_KEYS.musicVolume);
    loaded.effectsVolume = readVolume(storage, SETTING_KEYS.effectsVolume);
    const screenShake = storage.getItem(SETTING_KEYS.screenShake);
    if (SCREEN_SHAKE_LEVELS.includes(screenShake)) loaded.screenShake = screenShake;
    loaded.reduceFlashes = storage.getItem(SETTING_KEYS.reduceFlashes) === 'true';
  } catch {
    return defaultSettings();
  }
  return loaded;
}

export function saveSettings(storage, settingsToSave) {
  try {
    for (const [name, key] of Object.entries(SETTING_KEYS)) storage.setItem(key, String(settingsToSave[name]));
  } catch {
    // The choices just are not remembered.
  }
}

export function volumeScale(steps) {
  return steps / VOLUME_STEPS;
}

export function screenShakeScale() {
  return SCREEN_SHAKE_SCALE[settings.screenShake];
}

// 1 for a full strength flash, less when Reduce flashes is on.
export function flashStrength() {
  return settings.reduceFlashes ? REDUCED_FLASH_STRENGTH : 1;
}
