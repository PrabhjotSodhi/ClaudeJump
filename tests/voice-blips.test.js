import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { EventEmitter } from '../src/engine/events.js';
import { SoundPlayer } from '../src/engine/sound-player.js';
import { CHARACTERS } from '../src/entities/characters.js';

const soundDefinitions = JSON.parse(readFileSync('data/sfx/sounds.json', 'utf8'));
const voiceBlips = JSON.parse(readFileSync('data/sfx/voice-blips.json', 'utf8'));
const BLIP_NAMES = ['jump', 'hit', 'fall', 'win'];

function fakeAudioContext() {
  const context = { startFrequencies: [], currentTime: 0, sampleRate: 100, state: 'running' };
  const node = () => ({ connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } });
  context.destination = node();
  context.createGain = node;
  context.createStereoPanner = () => ({ connect() {}, pan: { value: 0 } });
  const source = () => ({
    connect() {},
    frequency: {
      setValueAtTime: (frequency) => context.startFrequencies.push(frequency),
      exponentialRampToValueAtTime() {},
    },
    start() {},
    stop() {},
  });
  context.createOscillator = source;
  context.createBufferSource = source;
  context.createBuffer = () => ({ getChannelData: () => new Float32Array(100) });
  return context;
}

function setUp(players) {
  const audioContext = fakeAudioContext();
  const soundPlayer = new SoundPlayer({
    soundDefinitions,
    eventSounds: {},
    voiceBlips,
    storage: { getItem: () => null, setItem() {} },
    createAudioContext: () => audioContext,
    random: () => 0.5,
  });
  soundPlayer.unlock();
  const events = new EventEmitter();
  soundPlayer.attach(events, () => players);
  return { audioContext, events };
}

const loudest = (voices) => Math.max(...voices.map((voice) => (voice.volume ?? 0) + (voice.noiseVolume ?? 0)));

test('every character has a jump, hit, fall and win blip', () => {
  for (const { name } of CHARACTERS)
    for (const blipName of BLIP_NAMES) assert.ok(voiceBlips.characters[name]?.[blipName]?.length > 0, name);
});

test('characters differ in pitch and tone', () => {
  const voices = CHARACTERS.map(({ name }) => voiceBlips.characters[name].jump[0]);
  const pitches = voices.map((voice) => voice.startFrequency).sort((first, second) => first - second);
  for (let index = 1; index < pitches.length; index++) assert.ok(pitches[index] / pitches[index - 1] > 1.05);
  assert.ok(new Set(voices.map((voice) => voice.waveform)).size >= 3);
});

test('blips are quieter than the lightest hit sound', () => {
  const lightestHit = loudest(soundDefinitions['hit-light']);
  for (const { name } of CHARACTERS)
    for (const blipName of BLIP_NAMES) assert.ok(loudest(voiceBlips.characters[name][blipName]) < lightestHit / 2);
});

test('a jump speaks in the voice of the character who jumped', () => {
  const players = [
    { id: 'red', character: CHARACTERS.find(({ name }) => name === 'muse') },
    { id: 'blue', character: CHARACTERS.find(({ name }) => name === 'gemini') },
  ];
  const { audioContext, events } = setUp(players);

  events.emit('player-jumped', { playerId: 'blue' });

  assert.deepEqual(audioContext.startFrequencies, [voiceBlips.characters.gemini.jump[0].startFrequency]);
});

test('no more than two blips sound at once', () => {
  const players = ['red', 'blue', 'green', 'yellow'].map((id, index) => ({ id, character: CHARACTERS[index] }));
  const { audioContext, events } = setUp(players);

  events.emit('rocket-exploded', { x: 100, playerIds: ['red', 'blue', 'green', 'yellow'] });
  const blipsDuringBlast = audioContext.startFrequencies.length;
  audioContext.currentTime += 1;
  events.emit('player-jumped', { playerId: 'yellow' });

  assert.equal(blipsDuringBlast, 2);
  assert.equal(audioContext.startFrequencies.length, 3, 'a new blip plays once the others have ended');
});
