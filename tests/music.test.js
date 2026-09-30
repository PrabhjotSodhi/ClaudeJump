import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { EventEmitter } from '../src/engine/events.js';
import { MusicPlayer } from '../src/engine/music-player.js';
import {
  channelTokens,
  HIGHEST_SEMITONE,
  LOWEST_SEMITONE,
  parseChannel,
  semitonesFromA4,
} from '../src/engine/music-sequencer.js';
import { SceneManager } from '../src/engine/scene-manager.js';
import { SoundPlayer } from '../src/engine/sound-player.js';
import { PausableMatchScene } from '../src/scenes/pausable-match-scene.js';
import { TitleScene } from '../src/scenes/title-scene.js';

const tracks = {
  menu: JSON.parse(readFileSync('data/music/menu.json', 'utf8')),
  match: JSON.parse(readFileSync('data/music/match.json', 'utf8')),
};
const MIN_BARS = 8;
const MAX_BARS = 16;

function fakeStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

// Records when every oscillator and noise source is told to start and the latest volume target.
function fakeAudioContext() {
  const context = { startTimes: [], currentTime: 0, sampleRate: 100, state: 'running', busCount: 0, volumeTargets: [] };
  const audioParam = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime: (target) => context.volumeTargets.push(target),
  });
  const node = () => ({
    connect() {},
    disconnect() {},
    gain: audioParam(),
    frequency: audioParam(),
    pan: audioParam(),
  });
  context.destination = node();
  context.createGain = () => {
    context.busCount++;
    return node();
  };
  context.createStereoPanner = node;
  context.createBiquadFilter = node;
  const source = () => ({
    ...node(),
    start: (time) => context.startTimes.push(time),
    stop() {},
  });
  context.createOscillator = source;
  context.createBufferSource = source;
  context.createBuffer = () => ({ getChannelData: () => new Float32Array(100) });
  return context;
}

function setUp({ storage = fakeStorage(), audioContext = fakeAudioContext() } = {}) {
  const soundPlayer = new SoundPlayer({
    soundDefinitions: {},
    eventSounds: {},
    storage,
    createAudioContext: () => audioContext,
  });
  soundPlayer.unlock();
  const musicPlayer = new MusicPlayer({ soundPlayer, tracks });
  return { audioContext, soundPlayer, musicPlayer };
}

function startTimesWhilePumping(audioContext, musicPlayer, seconds) {
  audioContext.startTimes.length = 0;
  const startTime = audioContext.currentTime;
  while (audioContext.currentTime < startTime + seconds) {
    musicPlayer.pump();
    audioContext.currentTime += 0.05;
  }
  return audioContext.startTimes.slice();
}

for (const [trackName, track] of Object.entries(tracks)) {
  test(`the ${trackName} track has valid notes and loops in whole bars`, () => {
    assert.ok(track.bars >= MIN_BARS && track.bars <= MAX_BARS);
    const stepsPerBar = track.beatsPerBar * track.stepsPerBeat;
    for (const [channelName, channel] of Object.entries(track.channels)) {
      assert.equal(channel.bars.length, track.bars, `${channelName} has the wrong number of bars`);
      channel.bars.forEach((bar, barIndex) => {
        assert.equal(bar.trim().split(/\s+/).length, stepsPerBar, `${channelName} bar ${barIndex + 1} is not whole`);
      });
      assert.equal(channelTokens(channel).length, track.bars * stepsPerBar);
      if (channel.drums) continue;
      for (const step of parseChannel(channel)) {
        if (!step) continue;
        assert.ok(step.semitones >= LOWEST_SEMITONE && step.semitones <= HIGHEST_SEMITONE, `${channelName} note range`);
      }
    }
  });
}

test('note names and semitone numbers give the same pitches', () => {
  assert.equal(semitonesFromA4('A4'), 0);
  assert.equal(semitonesFromA4('C4'), -9);
  assert.equal(semitonesFromA4('F#3'), -15);
  assert.equal(semitonesFromA4('7'), 7);
  assert.throws(() => semitonesFromA4('H2'));
});

test('the music starts on the audio clock, slightly ahead of now', () => {
  const { audioContext, musicPlayer } = setUp();
  audioContext.currentTime = 10;
  musicPlayer.playTrack('menu');

  const startTimes = startTimesWhilePumping(audioContext, musicPlayer, 2);

  assert.ok(startTimes.length > 0);
  assert.ok(Math.min(...startTimes) >= 10);
});

test('the music never plays before the sound player is unlocked', () => {
  const soundPlayer = new SoundPlayer({ soundDefinitions: {}, eventSounds: {}, createAudioContext: () => null });
  const musicPlayer = new MusicPlayer({ soundPlayer, tracks });
  musicPlayer.playTrack('menu');

  assert.doesNotThrow(() => musicPlayer.pump());
});

test('scenes pick the track: menus play menu, matches play match', () => {
  const sceneManager = new SceneManager({});
  const title = new TitleScene({ sceneManager, levels: [], sprites: {} });
  const match = new PausableMatchScene({ sceneManager, matchScene: { events: new EventEmitter() } });

  assert.equal(title.musicTrackName, 'menu');
  assert.equal(match.musicTrackName, 'match');
});

test('changing scene crossfades: the old track fades out as the new one starts', () => {
  const { audioContext, musicPlayer } = setUp();
  const sceneManager = new SceneManager({ musicPlayer });
  sceneManager.setScene({ events: new EventEmitter(), musicTrackName: 'menu', update() {} });
  musicPlayer.pump();

  sceneManager.setScene({ events: new EventEmitter(), musicTrackName: 'match', update() {} });
  musicPlayer.pump();

  assert.equal(musicPlayer.playingTrackName, 'match');
  assert.equal(musicPlayer.playingSequencer.track, tracks.match);
  assert.equal(musicPlayer.retiredSequencers.length, 1);
});

function shortestStepSeconds(startTimes) {
  const sortedTimes = [...new Set(startTimes)].sort((first, second) => first - second);
  return Math.min(...sortedTimes.slice(1).map((time, index) => time - sortedTimes[index]));
}

test('sudden death makes the music faster and the next round is calm again', () => {
  const { audioContext, musicPlayer } = setUp();
  const events = new EventEmitter();
  musicPlayer.attach(events);
  musicPlayer.playTrack('match');
  const calmStepSeconds = shortestStepSeconds(startTimesWhilePumping(audioContext, musicPlayer, 4));

  events.emit('sudden-death-started', {});
  startTimesWhilePumping(audioContext, musicPlayer, 1);
  const hurriedStepSeconds = shortestStepSeconds(startTimesWhilePumping(audioContext, musicPlayer, 4));
  events.emit('round-started', {});
  startTimesWhilePumping(audioContext, musicPlayer, 1);
  const calmAgainStepSeconds = shortestStepSeconds(startTimesWhilePumping(audioContext, musicPlayer, 4));

  assert.ok(hurriedStepSeconds < calmStepSeconds * 0.9);
  assert.ok(Math.abs(calmAgainStepSeconds - calmStepSeconds) < 0.001);
});

test('muting sound, turning music off and pausing change the music volume', () => {
  const { audioContext, soundPlayer, musicPlayer } = setUp();
  musicPlayer.playTrack('match');
  const currentVolume = () => {
    musicPlayer.pump();
    return audioContext.volumeTargets.at(-1);
  };
  const normalVolume = currentVolume();

  musicPlayer.setPaused(true);
  const pausedVolume = currentVolume();
  musicPlayer.setPaused(false);
  soundPlayer.toggleSound();
  const mutedVolume = currentVolume();
  soundPlayer.toggleSound();

  assert.ok(normalVolume > 0);
  assert.ok(pausedVolume > 0 && pausedVolume < normalVolume);
  assert.equal(mutedVolume, 0);
});
