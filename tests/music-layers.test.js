import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { KNOCKOUT_SLOWMO_TICKS, ROUND_COUNTDOWN_TICKS, TICK_RATE, TIME_LOW_SECONDS } from '../src/engine/config.js';
import { EventEmitter } from '../src/engine/events.js';
import { MusicPlayer } from '../src/engine/music-player.js';
import { channelTokens, parseChannel } from '../src/engine/music-sequencer.js';
import { SoundPlayer } from '../src/engine/sound-player.js';
import { CHARACTERS } from '../src/entities/characters.js';
import { PLAYERS } from '../src/levels/versus-arena.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { harborLevel } from './fixtures/harbor-level.mjs';

const readJson = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const matchTrack = readJson('data/music/match.json');
const stingers = readJson('data/music/stingers.json');
const jingles = readJson('data/music/win-jingles.json');
const STEP_SECONDS = 60 / (matchTrack.tempo * matchTrack.stepsPerBeat);
const BEAT_SECONDS = STEP_SECONDS * matchTrack.stepsPerBeat;

// Records every oscillator start with its waveform and pitch.
function fakeAudioContext() {
  const context = { starts: [], currentTime: 0, sampleRate: 100, state: 'running' };
  const audioParam = () => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
  });
  const node = () => ({ connect() {}, disconnect() {}, gain: audioParam(), frequency: audioParam() });
  context.destination = node();
  context.createGain = node;
  context.createBiquadFilter = node;
  context.createOscillator = () => {
    const oscillator = { ...node(), type: 'sine', stop() {} };
    oscillator.start = (time) =>
      context.starts.push({ time, type: oscillator.type, frequency: oscillator.frequency.value });
    return oscillator;
  };
  context.createBufferSource = () => ({ ...node(), start() {}, stop() {} });
  context.createBuffer = () => ({ getChannelData: () => new Float32Array(100) });
  return context;
}

function setUp() {
  const audioContext = fakeAudioContext();
  const soundPlayer = new SoundPlayer({
    soundDefinitions: {},
    eventSounds: {},
    storage: { getItem: () => null, setItem() {} },
    createAudioContext: () => audioContext,
  });
  soundPlayer.unlock();
  const musicPlayer = new MusicPlayer({ soundPlayer, tracks: { match: matchTrack }, jingles, stingers });
  const events = new EventEmitter();
  musicPlayer.attach(events);
  musicPlayer.playTrack('match');
  const pumpFor = (seconds) => {
    const endTime = audioContext.currentTime + seconds;
    while (audioContext.currentTime < endTime) {
      musicPlayer.pump();
      audioContext.currentTime += 0.05;
    }
  };
  pumpFor(0.1);
  return { audioContext, musicPlayer, events, pumpFor, trackStartTime: musicPlayer.playingSequencer.nextStepTime };
}

const isTension = (start) => start.type === 'sawtooth';
const isSuddenDeathPulse = (start) => start.type === 'square' && start.frequency < 200;

test('the match track has a tension layer and a sudden death layer', () => {
  const layers = Object.values(matchTrack.channels).map((channel) => channel.layer);
  assert.ok(layers.includes('tension'));
  assert.ok(layers.includes('suddenDeath'));
  for (const channel of Object.values(matchTrack.channels)) {
    assert.equal(channelTokens(channel).length, matchTrack.bars * matchTrack.beatsPerBar * matchTrack.stepsPerBeat);
    if (!channel.drums) parseChannel(channel);
  }
});

test('the tension layer is silent until time runs low, then joins on the beat', () => {
  const { audioContext, events, pumpFor, trackStartTime } = setUp();
  pumpFor(3.03);
  assert.equal(audioContext.starts.filter(isTension).length, 0);

  events.emit('round-time-low', {});
  pumpFor(3);

  const tensionStarts = audioContext.starts.filter(isTension);
  assert.ok(tensionStarts.length > 0);
  const beatsIn = (tensionStarts[0].time - trackStartTime) / BEAT_SECONDS;
  assert.ok(Math.abs(beatsIn - Math.round(beatsIn)) < 1e-6, 'first tension note lands on a beat');
  assert.equal(audioContext.starts.filter(isSuddenDeathPulse).length, 0);
});

test('sudden death adds its layer and the next round starts calm', () => {
  const { audioContext, events, pumpFor } = setUp();
  events.emit('round-time-low', {});
  events.emit('sudden-death-started', {});
  pumpFor(2);
  assert.ok(audioContext.starts.filter(isSuddenDeathPulse).length > 0);

  events.emit('round-started', {});
  pumpFor(1);
  audioContext.starts.length = 0;
  pumpFor(3);

  assert.equal(audioContext.starts.filter(isSuddenDeathPulse).length, 0);
  assert.equal(audioContext.starts.filter(isTension).length, 0);
});

test('stingers play for match point, the last knockout and the match win, then the win jingle', () => {
  for (const [eventName, stingerName] of [
    ['match-point', 'matchPoint'],
    ['final-knockout', 'finalKnockout'],
  ]) {
    const { musicPlayer, events, pumpFor } = setUp();
    events.emit(eventName, {});
    pumpFor(0.1);
    assert.equal(musicPlayer.oneShotSequencer?.track, stingers[stingerName], stingerName);
  }

  const { musicPlayer, events, pumpFor } = setUp();
  events.emit('match-won', { playerId: 'blue', characterName: 'grok' });
  pumpFor(0.1);
  assert.equal(musicPlayer.oneShotSequencer.track, stingers.matchWin);
  pumpFor(4);
  assert.equal(musicPlayer.oneShotSequencer.track, jingles.grok);
});

function idleInputs(scene) {
  return Object.fromEntries(scene.players.map((player) => [player.id, { left: false, right: false, jump: false }]));
}

function recordEvents(scene, eventNames) {
  const emitted = [];
  for (const eventName of eventNames) scene.events.on(eventName, () => emitted.push([scene.tickCount, eventName]));
  return emitted;
}

test('a round tells the music once when ten seconds are left before sudden death', () => {
  const players = PLAYERS.slice(0, 2).map(({ id }, index) => ({ id, character: CHARACTERS[index] }));
  const scene = new VersusScene({ level: harborLevel, seed: 0, players });
  const emitted = recordEvents(scene, ['round-time-low', 'sudden-death-started']);
  for (let tick = 0; tick < ROUND_COUNTDOWN_TICKS + 40 * TICK_RATE; tick++) scene.update(idleInputs(scene));

  assert.deepEqual(
    emitted.map(([, eventName]) => eventName),
    ['round-time-low', 'sudden-death-started'],
  );
  const [[lowTick], [suddenDeathTick]] = emitted;
  assert.equal(suddenDeathTick - lowTick, TIME_LOW_SECONDS * TICK_RATE);
});

test('match point and the final knockout are announced to the music', () => {
  const players = PLAYERS.slice(0, 2).map(({ id }, index) => ({ id, character: CHARACTERS[index] }));
  const scene = new VersusScene({ level: harborLevel, seed: 0, players });
  const emitted = recordEvents(scene, ['match-point', 'final-knockout', 'match-won']);
  scene.wins.blue = scene.winsNeeded - 2;
  const winRoundForBlue = () => {
    for (let tick = 0; tick < ROUND_COUNTDOWN_TICKS; tick++) scene.update(idleInputs(scene));
    scene.players.find((player) => player.id === 'red').y = 600;
    for (let tick = 0; tick < KNOCKOUT_SLOWMO_TICKS + 2; tick++) scene.update(idleInputs(scene));
    while (scene.phase === 'point' || scene.phase === 'modifier') {
      if (scene.phase === 'modifier') scene.update({ red: { jump: true }, blue: { jump: true } });
      else scene.update(idleInputs(scene));
    }
  };

  winRoundForBlue();
  assert.deepEqual(
    emitted.map(([, eventName]) => eventName),
    ['match-point'],
  );
  winRoundForBlue();
  assert.deepEqual(
    emitted.map(([, eventName]) => eventName),
    ['match-point', 'final-knockout', 'match-won'],
  );
});
