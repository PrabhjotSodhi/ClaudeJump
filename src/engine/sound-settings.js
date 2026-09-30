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
