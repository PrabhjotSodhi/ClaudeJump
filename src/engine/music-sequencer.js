const A4_FREQUENCY = 440;
const SEMITONES_PER_OCTAVE = 12;
// Notes are written as names (A4, F#3, Bb2) or as whole semitones away from A4. Both must stay in this range.
export const LOWEST_SEMITONE = -36;
export const HIGHEST_SEMITONE = 27;
const SEMITONES_FROM_C = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const C4_SEMITONES_BELOW_A4 = 9;
const NOTE_NAME_PATTERN = /^([A-G])([#b]?)(-?\d)$/;
const WHOLE_NUMBER_PATTERN = /^-?\d+$/;

const REST = '.';
const HOLD = '-';
const DRUM_SEPARATOR = '+';
// A note sounds for this share of its length, so repeated notes stay separate.
const NOTE_GATE = 0.92;
const NOTE_ATTACK_SECONDS = 0.01;
const SILENT_GAIN = 0.0001;

// Each drum is a sine sweep, a burst of filtered noise, or both.
const DRUMS = {
  kick: { startFrequency: 150, endFrequency: 45, duration: 0.14, volume: 0.9 },
  snare: { filterType: 'bandpass', filterFrequency: 1800, duration: 0.11, noiseVolume: 0.45 },
  hat: { filterType: 'highpass', filterFrequency: 7000, duration: 0.04, noiseVolume: 0.22 },
};
const DRUM_NAMES = { k: 'kick', s: 'snare', h: 'hat' };

export function semitonesFromA4(noteToken) {
  if (WHOLE_NUMBER_PATTERN.test(noteToken)) return Number(noteToken);
  const match = NOTE_NAME_PATTERN.exec(noteToken);
  if (!match) throw new Error(`Not a note: ${noteToken}`);
  const [, letter, accidental, octave] = match;
  const accidentalSemitones = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return (
    SEMITONES_FROM_C[letter] + accidentalSemitones + (Number(octave) - 4) * SEMITONES_PER_OCTAVE - C4_SEMITONES_BELOW_A4
  );
}

// One token per step, in order: the loop's whole length for one channel.
export function channelTokens(channel) {
  return channel.bars.flatMap((bar) => bar.trim().split(/\s+/));
}

// Turns a channel's tokens into one entry per step: null for a rest, or what starts there.
// Melodic steps are { semitones, length }; drum steps are a list of drum names.
export function parseChannel(channel) {
  const steps = [];
  for (const token of channelTokens(channel)) {
    if (token === REST) {
      steps.push(null);
    } else if (channel.drums) {
      steps.push(token.split(DRUM_SEPARATOR).map((letter) => DRUMS[DRUM_NAMES[letter]] && DRUM_NAMES[letter]));
      if (steps.at(-1).includes(undefined)) throw new Error(`Not a drum hit: ${token}`);
    } else if (token === HOLD) {
      const previousNote = steps.findLast((step) => step);
      if (!previousNote || steps.at(-1) === null) throw new Error('A hold must follow a note');
      previousNote.length++;
      steps.push(previousNote);
    } else {
      steps.push({ semitones: semitonesFromA4(token), length: 1 });
    }
  }
  return steps;
}

// Plays one track on the audio clock. scheduleUntil() is called often and queues every step that
// starts before the given time, so timing never depends on game ticks or animation frames. A track that does not
// loop plays once and then stays silent.
export class MusicSequencer {
  constructor({ audioContext, destination, noiseBuffer, track, startTime, loops = true }) {
    this.loops = loops;
    // Channels with a layer play only while it is active. Wanted layers become active on the next beat.
    this.wantedLayers = new Set();
    this.activeLayers = new Set();
    this.audioContext = audioContext;
    this.noiseBuffer = noiseBuffer;
    this.track = track;
    this.channels = Object.values(track.channels).map((channel) => ({ channel, steps: parseChannel(channel) }));
    this.stepCount = track.bars * track.beatsPerBar * track.stepsPerBeat;
    this.stepIndex = 0;
    this.nextStepTime = startTime;
    this.bus = audioContext.createGain();
    this.bus.connect(destination);
  }

  fade(fromGain, toGain, startTime, seconds) {
    this.bus.gain.setValueAtTime(fromGain, startTime);
    this.bus.gain.linearRampToValueAtTime(toGain, startTime + seconds);
  }

  scheduleUntil(time, tempoScale = 1) {
    const stepSeconds = 60 / (this.track.tempo * tempoScale * this.track.stepsPerBeat);
    while (this.nextStepTime < time && (this.loops || this.stepIndex < this.stepCount)) {
      this.scheduleStep(this.stepIndex % this.stepCount, this.nextStepTime, stepSeconds);
      this.stepIndex++;
      this.nextStepTime += stepSeconds;
    }
  }

  scheduleStep(stepInLoop, startTime, stepSeconds) {
    if (stepInLoop % this.track.stepsPerBeat === 0) this.activeLayers = new Set(this.wantedLayers);
    for (const { channel, steps } of this.channels) {
      const step = steps[stepInLoop];
      if (!step) continue;
      if (channel.layer && !this.activeLayers.has(channel.layer)) continue;
      if (channel.drums) {
        for (const drumName of step) this.playDrum(DRUMS[drumName], startTime);
      } else if (steps[stepInLoop - 1] !== step) {
        this.playNote(channel, step, startTime, step.length * stepSeconds * NOTE_GATE);
      }
    }
  }

  playNote(channel, note, startTime, duration) {
    const oscillator = this.audioContext.createOscillator();
    oscillator.type = channel.waveform;
    oscillator.frequency.value = A4_FREQUENCY * 2 ** (note.semitones / SEMITONES_PER_OCTAVE);
    const envelope = this.audioContext.createGain();
    envelope.gain.setValueAtTime(SILENT_GAIN, startTime);
    envelope.gain.exponentialRampToValueAtTime(channel.volume, startTime + NOTE_ATTACK_SECONDS);
    envelope.gain.exponentialRampToValueAtTime(SILENT_GAIN, startTime + duration);
    oscillator.connect(envelope);
    envelope.connect(this.bus);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  }

  playDrum(drum, startTime) {
    const endTime = startTime + drum.duration;
    const envelope = this.audioContext.createGain();
    envelope.gain.setValueAtTime(1, startTime);
    envelope.gain.exponentialRampToValueAtTime(SILENT_GAIN, endTime);
    envelope.connect(this.bus);

    if (drum.volume) {
      const oscillator = this.audioContext.createOscillator();
      oscillator.frequency.setValueAtTime(drum.startFrequency, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(drum.endFrequency, endTime);
      const oscillatorGain = this.audioContext.createGain();
      oscillatorGain.gain.value = drum.volume;
      oscillator.connect(oscillatorGain);
      oscillatorGain.connect(envelope);
      oscillator.start(startTime);
      oscillator.stop(endTime);
    }

    if (drum.noiseVolume) {
      const noise = this.audioContext.createBufferSource();
      noise.buffer = this.noiseBuffer;
      noise.loop = true;
      const filter = this.audioContext.createBiquadFilter();
      filter.type = drum.filterType;
      filter.frequency.value = drum.filterFrequency;
      const noiseGain = this.audioContext.createGain();
      noiseGain.gain.value = drum.noiseVolume;
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(envelope);
      noise.start(startTime);
      noise.stop(endTime);
    }
  }

  get finished() {
    return !this.loops && this.stepIndex >= this.stepCount;
  }

  stop() {
    this.bus.disconnect();
  }
}
