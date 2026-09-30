import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { EventEmitter } from '../src/engine/events.js';
import { SoundPlayer } from '../src/engine/sound-player.js';
import { loadSoundEnabled, saveSoundEnabled } from '../src/engine/sound-settings.js';
import { TitleScene } from '../src/scenes/title-scene.js';

const soundDefinitions = JSON.parse(readFileSync('data/sfx/sounds.json', 'utf8'));
const eventSounds = JSON.parse(readFileSync('data/sfx/event-sounds.json', 'utf8'));

const EVENTS_THAT_MAKE_SOUNDS = [
  'player-jumped',
  'player-landed',
  'player-shoved',
  'shove-charging',
  'shove-fully-charged',
  'shove-clash',
  'dash-hit',
  'crab-stomped',
  'card-picked-up',
  'card-played',
  'bomb-exploded',
  'rocket-exploded',
  'block-broken',
  'trap-sprung',
  'player-slipped',
  'player-burned',
  'player-pinched',
  'player-fell-in-water',
  'round-won',
  'sudden-death-started',
  'new-best',
  'menu-moved',
  'menu-selected',
];

function fakeStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

// Counts the oscillators and noise sources started, and records each panner's pan.
function fakeAudioContext() {
  const context = {
    startedSources: 0,
    startFrequencies: [],
    pans: [],
    currentTime: 0,
    sampleRate: 100,
    state: 'running',
  };
  const node = () => ({ connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } });
  context.destination = node();
  context.createGain = node;
  context.createStereoPanner = () => {
    const panner = { connect() {}, pan: { value: 0 } };
    context.pans.push(panner.pan);
    return panner;
  };
  const source = () => ({
    connect() {},
    frequency: {
      setValueAtTime(frequency) {
        context.startFrequencies.push(frequency);
      },
      exponentialRampToValueAtTime() {},
    },
    start() {
      context.startedSources++;
    },
    stop() {},
  });
  context.createOscillator = source;
  context.createBufferSource = source;
  context.createBuffer = () => ({ getChannelData: () => new Float32Array(100) });
  return context;
}

function unlockedPlayer(audioContext = fakeAudioContext(), storage = fakeStorage(), random = () => 0.5) {
  const soundPlayer = new SoundPlayer({
    soundDefinitions,
    eventSounds,
    storage,
    createAudioContext: () => audioContext,
    random,
  });
  soundPlayer.unlock();
  return soundPlayer;
}

test('every event that makes a sound maps to a sound definition that exists', () => {
  for (const eventName of EVENTS_THAT_MAKE_SOUNDS) {
    const mapping = eventSounds[eventName];
    assert.ok(mapping, `${eventName} has no sound`);
    const { by, ...soundNamesByValue } = typeof mapping === 'string' ? { any: mapping } : mapping;
    for (const soundName of Object.values(soundNamesByValue)) {
      assert.ok(soundDefinitions[soundName]?.length > 0, `${eventName} maps to missing sound ${soundName}`);
    }
  }
});

test('emitting an event starts its sound', () => {
  const audioContext = fakeAudioContext();
  const events = new EventEmitter();
  unlockedPlayer(audioContext).attach(events);

  events.emit('player-jumped', { playerId: 'red' });

  assert.ok(audioContext.startedSources > 0);
});

test('a fall into the sea plays the splash sound of its tier', () => {
  const audioContext = fakeAudioContext();
  const events = new EventEmitter();
  unlockedPlayer(audioContext).attach(events);
  const sourcesFor = (splashTier) => {
    const before = audioContext.startedSources;
    events.emit('player-fell-in-water', { playerId: 'red', splashTier });
    return audioContext.startedSources - before;
  };
  const smallSources = sourcesFor('small');
  const largeSources = sourcesFor('large');
  assert.ok(smallSources > 0);
  assert.ok(largeSources > smallSources, 'the large splash is layered heavier');
});

// The frequency of the first voice, the low thump, for one emitted event.
function thumpFrequencyFor(eventName, eventData) {
  const audioContext = fakeAudioContext();
  const events = new EventEmitter();
  unlockedPlayer(audioContext).attach(events);
  events.emit(eventName, eventData);
  return audioContext.startFrequencies[0];
}

test('a hit plays a thump, a crunch and a whoosh together', () => {
  const audioContext = fakeAudioContext();
  const events = new EventEmitter();
  unlockedPlayer(audioContext).attach(events);

  events.emit('player-shoved', { shoverId: 'red', targetId: 'blue', strength: 'medium' });

  assert.equal(audioContext.startFrequencies.length, 3, 'three tone layers');
  assert.equal(audioContext.startedSources, 5, 'three tones and the noise of the crunch and the whoosh');
});

test('a heavier hit has a lower thump', () => {
  const light = thumpFrequencyFor('player-shoved', { strength: 'light' });
  const medium = thumpFrequencyFor('player-shoved', { strength: 'medium' });
  const heavy = thumpFrequencyFor('dash-hit', { strength: 'heavy' });
  assert.ok(light > medium && medium > heavy);
});

test('each play varies the pitch a little', () => {
  const frequencyWith = (random) => {
    const audioContext = fakeAudioContext();
    const events = new EventEmitter();
    unlockedPlayer(audioContext, fakeStorage(), random).attach(events);
    events.emit('player-shoved', { strength: 'light' });
    return audioContext.startFrequencies[0];
  };
  const lowest = frequencyWith(() => 0);
  const middle = frequencyWith(() => 0.5);
  const highest = frequencyWith(() => 1);
  assert.ok(lowest < middle && middle < highest);
  assert.ok(highest / lowest < 1.4, 'the change stays slight');
});

test('the charge sound rises while a shove charges', () => {
  assert.ok(
    thumpFrequencyFor('shove-charging', { playerId: 'red', charge: 1 }) >
      thumpFrequencyFor('shove-charging', { playerId: 'red', charge: 0 }),
  );
});

test('a full charge and a clash each start a sound', () => {
  const audioContext = fakeAudioContext();
  const events = new EventEmitter();
  unlockedPlayer(audioContext).attach(events);

  events.emit('shove-fully-charged', { playerId: 'red' });
  const afterPing = audioContext.startedSources;
  events.emit('shove-clash', { x: 320, y: 100, playerIds: ['red', 'blue'] });

  assert.ok(afterPing > 0);
  assert.ok(audioContext.startedSources > afterPing);
});

test('the mute choice survives a reload', () => {
  const storage = fakeStorage();
  const firstVisit = new SoundPlayer({ soundDefinitions, eventSounds, storage });
  assert.equal(firstVisit.soundEnabled, true);

  firstVisit.toggleSound();

  const reloaded = new SoundPlayer({ soundDefinitions, eventSounds, storage });
  assert.equal(reloaded.soundEnabled, false);
  saveSoundEnabled(storage, true);
  assert.equal(loadSoundEnabled(storage), true);
});

test('muted sound starts nothing', () => {
  const audioContext = fakeAudioContext();
  const soundPlayer = unlockedPlayer(audioContext);
  soundPlayer.toggleSound();

  soundPlayer.play('jump');

  assert.equal(audioContext.startedSources, 0);
});

test('the same sound plays at most once per tick', () => {
  const audioContext = fakeAudioContext();
  const events = new EventEmitter();
  const soundPlayer = unlockedPlayer(audioContext);
  soundPlayer.attach(events);

  events.emit('rocket-exploded', { x: 100, playerIds: [] });
  events.emit('rocket-exploded', { x: 500, playerIds: [] });
  events.emit('bomb-exploded', { x: 300, playerIds: [] });
  const sourcesAfterOneTick = audioContext.startedSources;
  soundPlayer.endTick();
  events.emit('rocket-exploded', { x: 100, playerIds: [] });

  assert.equal(sourcesAfterOneTick, soundDefinitions.blast.length * 2);
  assert.equal(audioContext.startedSources, sourcesAfterOneTick * 2);
});

test('each player sound pans toward that player side', () => {
  const audioContext = fakeAudioContext();
  const events = new EventEmitter();
  unlockedPlayer(audioContext).attach(events);

  events.emit('player-jumped', { playerId: 'red' });
  events.emit('player-slipped', { playerId: 'blue' });

  assert.ok(audioContext.pans[0].value < 0);
  assert.ok(audioContext.pans[1].value > 0);
});

test('a missing audio context never throws', () => {
  const events = new EventEmitter();
  const soundPlayer = new SoundPlayer({ soundDefinitions, eventSounds, createAudioContext: () => null });
  soundPlayer.unlock();
  soundPlayer.attach(events);

  assert.doesNotThrow(() => events.emit('player-jumped', { playerId: 'red' }));
});

test('moving and confirming on the title screen emit menu events', () => {
  const scene = new TitleScene({ sceneManager: { setScene() {} }, levels: [], sprites: {} });
  const heard = [];
  scene.events.on('menu-moved', () => heard.push('menu-moved'));
  scene.events.on('menu-selected', () => heard.push('menu-selected'));
  const idle = { up: false, down: false, confirm: false };

  scene.update({ red: idle });
  scene.update({ red: { ...idle, down: true } });
  scene.update({ red: idle });
  scene.update({ red: { ...idle, confirm: true } });

  assert.deepEqual(heard, ['menu-moved', 'menu-selected']);
});
