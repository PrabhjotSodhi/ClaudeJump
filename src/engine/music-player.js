import { settings, volumeScale } from './sound-settings.js';
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
// While a stinger or win jingle plays, the looping track drops to this share of its volume.
const ONE_SHOT_DUCK_GAIN = 0.2;
const ONE_SHOT_DUCK_SECONDS = 0.1;
// A one-shot's last notes ring on for this long before the next one starts or the looping track comes back up.
const ONE_SHOT_TAIL_SECONDS = 0.6;

// Plays looping tracks for whichever scene is showing and crossfades between them. It shares the
// sound player's audio context, so it stays silent until the sound player is unlocked. It only
// listens: it never changes game state, and its timing comes from the audio clock.
// A track's channels may belong to a layer: "tension" joins when the round's time runs low and "suddenDeath" in sudden
// death, both on the next beat. Stingers and win jingles are one-shots in the track format. They play in turn over the
// ducked looping track.
export class MusicPlayer {
  // jingles holds one short win jingle per character name. stingers holds matchPoint, finalKnockout and matchWin.
  constructor({ soundPlayer, tracks, jingles = {}, stingers = {} }) {
    this.soundPlayer = soundPlayer;
    this.tracks = tracks;
    this.jingles = jingles;
    this.stingers = stingers;
    this.wantedLayers = new Set();
    this.oneShotQueue = [];
    this.oneShotSequencer = null;
    this.oneShotEndTime = 0;
    this.ducked = false;
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
    this.wantedLayers = new Set();
    this.oneShotQueue = [];
    if (!events) return;
    events.on('sudden-death-started', () => {
      this.suddenDeath = true;
      this.wantedLayers.add('suddenDeath');
    });
    events.on('round-started', () => {
      this.suddenDeath = false;
      this.wantedLayers.clear();
    });
    events.on('round-time-low', () => this.wantedLayers.add('tension'));
    events.on('match-point', () => this.queueOneShot(this.stingers.matchPoint));
    events.on('final-knockout', () => this.queueOneShot(this.stingers.finalKnockout));
    events.on('match-won', ({ characterName }) => {
      this.queueOneShot(this.stingers.matchWin);
      this.queueOneShot(this.jingles[characterName]);
    });
  }

  queueOneShot(track) {
    if (track) this.oneShotQueue.push(track);
  }

  playTrack(trackName) {
    this.wantedTrackName = trackName ?? null;
  }

  setPaused(paused) {
    this.paused = paused;
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
      if (this.playingSequencer) this.playingSequencer.wantedLayers = this.wantedLayers;
      this.playingSequencer?.scheduleUntil(now + LOOK_AHEAD_SECONDS, tempoScale);
      this.updateOneShots(audioContext, now);
      this.retiredSequencers = this.retiredSequencers.filter(({ sequencer, endTime }) => {
        if (endTime > now) return true;
        sequencer.stop();
        return false;
      });
    } catch {
      // Audio must never break the game.
    }
  }

  // One-shots play one after another. The looping track ducks while any play and comes back up once the last has rung
  // out.
  updateOneShots(audioContext, now) {
    if (!this.oneShotSequencer) {
      if (this.oneShotQueue.length === 0) return;
      this.startOneShot(this.oneShotQueue.shift(), audioContext, now);
    }
    this.oneShotSequencer.scheduleUntil(now + LOOK_AHEAD_SECONDS);
    if (!this.oneShotSequencer.finished) return;
    this.oneShotEndTime ||= this.oneShotSequencer.nextStepTime + ONE_SHOT_TAIL_SECONDS;
    if (now < this.oneShotEndTime) return;
    this.oneShotSequencer.stop();
    this.oneShotSequencer = null;
    this.oneShotEndTime = 0;
    if (this.oneShotQueue.length > 0) return;
    this.playingSequencer?.fade(ONE_SHOT_DUCK_GAIN, 1, now, ONE_SHOT_DUCK_SECONDS);
    this.ducked = false;
  }

  startOneShot(track, audioContext, now) {
    this.oneShotSequencer = new MusicSequencer({
      audioContext,
      destination: this.musicGain,
      noiseBuffer: this.soundPlayer.getNoiseBuffer(),
      track,
      startTime: now + START_DELAY_SECONDS,
      loops: false,
    });
    if (this.ducked) return;
    this.playingSequencer?.fade(1, ONE_SHOT_DUCK_GAIN, now, ONE_SHOT_DUCK_SECONDS);
    this.ducked = true;
  }

  updateVolume(audioContext, now) {
    this.musicGain ??= this.createMusicGain(audioContext);
    const audible = this.soundPlayer.soundEnabled;
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
