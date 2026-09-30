import { loadMusicEnabled, saveMusicEnabled, settings, volumeScale } from './sound-settings.js';
import { MusicSequencer } from './music-sequencer.js';

const MUSIC_VOLUME = 0.5;
// Music drops to this share of its volume while the game is paused.
const PAUSED_VOLUME_SCALE = 0.3;
const SUDDEN_DEATH_TEMPO_SCALE = 1.25;
const CROSSFADE_SECONDS = 1.2;
const VOLUME_SMOOTHING_SECONDS = 0.05;
// Notes are queued this far ahead of the audio clock, and the queue is topped up this often.
const LOOK_AHEAD_SECONDS = 0.25;
const PUMP_INTERVAL_MILLISECONDS = 50;
const START_DELAY_SECONDS = 0.05;

// Plays looping tracks for whichever scene is showing and crossfades between them. It shares the
// sound player's audio context, so it stays silent until the sound player is unlocked. It only
// listens: it never changes game state, and its timing comes from the audio clock.
export class MusicPlayer {
  constructor({ soundPlayer, tracks, storage = null }) {
    this.soundPlayer = soundPlayer;
    this.tracks = tracks;
    this.storage = storage;
    this.musicEnabled = storage ? loadMusicEnabled(storage) : true;
    this.wantedTrackName = null;
    this.paused = false;
    this.suddenDeath = false;
    this.playingSequencer = null;
    this.playingTrackName = null;
    this.retiredSequencers = [];
    this.musicGain = null;
  }

  // A new scene starts calm: sudden death only speeds up the round that raised it.
  attach(events) {
    this.suddenDeath = false;
    if (!events) return;
    events.on('sudden-death-started', () => (this.suddenDeath = true));
    events.on('round-started', () => (this.suddenDeath = false));
  }

  playTrack(trackName) {
    this.wantedTrackName = trackName ?? null;
  }

  setPaused(paused) {
    this.paused = paused;
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (this.storage) saveMusicEnabled(this.storage, this.musicEnabled);
  }

  start() {
    setInterval(() => this.pump(), PUMP_INTERVAL_MILLISECONDS).unref?.();
  }

  // Follows the wanted track, sets the volume and queues upcoming notes. Does nothing until unlocked.
  pump() {
    const audioContext = this.soundPlayer.audioContext;
    if (!audioContext) return;
    try {
      const now = audioContext.currentTime;
      this.updateVolume(audioContext, now);
      if (this.wantedTrackName !== this.playingTrackName) this.crossfadeTo(this.wantedTrackName, audioContext, now);
      const tempoScale = this.suddenDeath ? SUDDEN_DEATH_TEMPO_SCALE : 1;
      this.playingSequencer?.scheduleUntil(now + LOOK_AHEAD_SECONDS, tempoScale);
      this.retiredSequencers = this.retiredSequencers.filter(({ sequencer, endTime }) => {
        if (endTime > now) return true;
        sequencer.stop();
        return false;
      });
    } catch {
      // Audio must never break the game.
    }
  }

  updateVolume(audioContext, now) {
    this.musicGain ??= this.createMusicGain(audioContext);
    const audible = this.soundPlayer.soundEnabled && this.musicEnabled;
    const pausedScale = this.paused ? PAUSED_VOLUME_SCALE : 1;
    const volume = audible ? MUSIC_VOLUME * volumeScale(settings.musicVolume) * pausedScale : 0;
    this.musicGain.gain.setTargetAtTime(volume, now, VOLUME_SMOOTHING_SECONDS);
  }

  createMusicGain(audioContext) {
    const musicGain = audioContext.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(this.soundPlayer.getMasterGain());
    return musicGain;
  }

  crossfadeTo(trackName, audioContext, now) {
    if (this.playingSequencer) {
      this.playingSequencer.fade(1, 0, now, CROSSFADE_SECONDS);
      this.retiredSequencers.push({ sequencer: this.playingSequencer, endTime: now + CROSSFADE_SECONDS });
    }
    this.playingTrackName = trackName;
    this.playingSequencer = null;
    if (!this.tracks[trackName]) return;
    this.playingSequencer = new MusicSequencer({
      audioContext,
      destination: this.musicGain,
      noiseBuffer: this.soundPlayer.getNoiseBuffer(),
      track: this.tracks[trackName],
      startTime: now + START_DELAY_SECONDS,
    });
    this.playingSequencer.fade(0, 1, now, CROSSFADE_SECONDS);
  }
}
