import { loadSoundEnabled, saveSoundEnabled } from './sound-settings.js';

const MASTER_VOLUME = 0.6;
// How far a sound pans toward its source, from 0 (centered) to 1 (fully to one side).
const MAX_PAN = 0.5;
const SCREEN_HALF_WIDTH = 320;
const DEFAULT_ATTACK_SECONDS = 0.005;
const NOISE_SECONDS = 1;
const SILENT_GAIN = 0.0001;
const PAN_BY_PLAYER_ID = { red: -MAX_PAN, blue: MAX_PAN };

// Sounds lean toward the side of the screen they happen on: the player's side, or the blast's x.
export function panFor(eventData) {
  const playerId = eventData?.playerId ?? eventData?.shoverId ?? eventData?.targetId;
  if (playerId in PAN_BY_PLAYER_ID) return PAN_BY_PLAYER_ID[playerId];
  if (typeof eventData?.x === 'number') {
    return Math.max(-MAX_PAN, Math.min(MAX_PAN, (eventData.x / SCREEN_HALF_WIDTH - 1) * MAX_PAN));
  }
  return 0;
}

function defaultCreateAudioContext() {
  const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

// Turns scene events into synthesized sounds. It only listens: it never changes game state.
// A sound definition is a list of voices, each a tiny synth note:
// { waveform, startFrequency, endFrequency, duration, volume, noiseVolume, attack, delay }.
// Without an audio context (headless browsers, tests) every call does nothing.
export class SoundPlayer {
  constructor({ soundDefinitions, eventSounds, storage = null, createAudioContext = defaultCreateAudioContext }) {
    this.soundDefinitions = soundDefinitions;
    this.eventSounds = eventSounds;
    this.storage = storage;
    this.createAudioContext = createAudioContext;
    this.soundEnabled = storage ? loadSoundEnabled(storage) : true;
    this.audioContext = null;
    this.masterGain = null;
    this.noiseBuffer = null;
    this.soundsPlayedThisTick = new Set();
  }

  attach(events) {
    if (!events) return;
    for (const eventName in this.eventSounds) {
      events.on(eventName, (eventData) => this.play(this.eventSounds[eventName], panFor(eventData)));
    }
  }

  // Browsers only allow audio after a user gesture, so call this from key, touch and gamepad input.
  unlock() {
    try {
      this.audioContext ??= this.createAudioContext();
      if (this.audioContext?.state === 'suspended') this.audioContext.resume().catch(() => {});
    } catch {
      this.audioContext = null;
    }
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    if (this.storage) saveSoundEnabled(this.storage, this.soundEnabled);
  }

  // The same sound plays at most once per tick, so a blast that hits many things is not a loud burst.
  endTick() {
    this.soundsPlayedThisTick.clear();
  }

  play(soundName, pan = 0) {
    if (!this.soundEnabled || !this.audioContext || this.soundsPlayedThisTick.has(soundName)) return;
    this.soundsPlayedThisTick.add(soundName);
    try {
      const panner = this.audioContext.createStereoPanner();
      panner.pan.value = pan;
      panner.connect(this.getMasterGain());
      const startTime = this.audioContext.currentTime;
      for (const voice of this.soundDefinitions[soundName]) this.playVoice(voice, panner, startTime);
    } catch {
      // Audio must never break the game.
    }
  }

  getMasterGain() {
    if (!this.masterGain) {
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = MASTER_VOLUME;
      this.masterGain.connect(this.audioContext.destination);
    }
    return this.masterGain;
  }

  playVoice(voice, destination, soundStartTime) {
    const startTime = soundStartTime + (voice.delay ?? 0);
    const endTime = startTime + voice.duration;

    const envelope = this.audioContext.createGain();
    envelope.connect(destination);
    envelope.gain.setValueAtTime(SILENT_GAIN, startTime);
    envelope.gain.exponentialRampToValueAtTime(1, startTime + (voice.attack ?? DEFAULT_ATTACK_SECONDS));
    envelope.gain.exponentialRampToValueAtTime(SILENT_GAIN, endTime);

    if (voice.volume) {
      const oscillator = this.audioContext.createOscillator();
      oscillator.type = voice.waveform;
      oscillator.frequency.setValueAtTime(voice.startFrequency, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(voice.endFrequency, endTime);
      const oscillatorGain = this.audioContext.createGain();
      oscillatorGain.gain.value = voice.volume;
      oscillator.connect(oscillatorGain);
      oscillatorGain.connect(envelope);
      oscillator.start(startTime);
      oscillator.stop(endTime);
    }

    if (voice.noiseVolume) {
      const noise = this.audioContext.createBufferSource();
      noise.buffer = this.getNoiseBuffer();
      noise.loop = true;
      const noiseGain = this.audioContext.createGain();
      noiseGain.gain.value = voice.noiseVolume;
      noise.connect(noiseGain);
      noiseGain.connect(envelope);
      noise.start(startTime);
      noise.stop(endTime);
    }
  }

  getNoiseBuffer() {
    if (!this.noiseBuffer) {
      const sampleCount = Math.floor(this.audioContext.sampleRate * NOISE_SECONDS);
      this.noiseBuffer = this.audioContext.createBuffer(1, sampleCount, this.audioContext.sampleRate);
      const samples = this.noiseBuffer.getChannelData(0);
      // Audio only, so Math.random is fine: it never touches game state.
      for (let index = 0; index < sampleCount; index++) samples[index] = Math.random() * 2 - 1;
    }
    return this.noiseBuffer;
  }
}
