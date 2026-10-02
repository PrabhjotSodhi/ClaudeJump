import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from '../src/engine/events.js';
import { MusicPlayer } from '../src/engine/music-player.js';
import { SoundPlayer } from '../src/engine/sound-player.js';
import { defaultSettings, loadSettings, saveSettings, settings } from '../src/engine/sound-settings.js';
import { PausableMatchScene } from '../src/scenes/pausable-match-scene.js';
import { TitleScene } from '../src/scenes/title-scene.js';
import { changeSetting } from '../src/ui/settings-menu.js';
import { ClashSparks, drawClashSparks } from '../src/vfx/clash-sparks.js';
import { ScreenShake } from '../src/vfx/screen-shake.js';

function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

const throwingStorage = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
};

// Runs the check with the live settings changed, then puts them back.
function withSettings(changes, check) {
  const saved = { ...settings };
  Object.assign(settings, changes);
  try {
    check();
  } finally {
    Object.assign(settings, saved);
  }
}

test('settings default to full volume, full shake and flashes on', () => {
  assert.deepEqual(loadSettings(fakeStorage()), defaultSettings());
  assert.deepEqual(defaultSettings(), {
    musicVolume: 10,
    effectsVolume: 10,
    screenShake: 'full',
    reduceFlashes: false,
  });
});

test('settings fall back to defaults when storage throws', () => {
  assert.deepEqual(loadSettings(throwingStorage), defaultSettings());
  assert.doesNotThrow(() => saveSettings(throwingStorage, defaultSettings()));
});

test('settings fall back to defaults when the stored values are invalid', () => {
  const storage = fakeStorage({
    'claudejump-music-volume': '11',
    'claudejump-effects-volume': 'loud',
    'claudejump-screen-shake': 'huge',
    'claudejump-reduce-flashes': 'maybe',
  });

  assert.deepEqual(loadSettings(storage), defaultSettings());
});

test('saved settings load back the same', () => {
  const storage = fakeStorage();
  const chosen = { musicVolume: 3, effectsVolume: 0, screenShake: 'low', reduceFlashes: true };

  saveSettings(storage, chosen);

  assert.deepEqual(loadSettings(storage), chosen);
});

test('changeSetting steps every setting and wraps at the ends, so one button reaches every value', () => {
  const chosen = defaultSettings();
  changeSetting(chosen, 'musicVolume', 1);
  assert.equal(chosen.musicVolume, 0, 'past full volume wraps to silent');
  changeSetting(chosen, 'musicVolume', 1);
  assert.equal(chosen.musicVolume, 1);
  chosen.effectsVolume = 0;
  changeSetting(chosen, 'effectsVolume', -1);
  assert.equal(chosen.effectsVolume, 10);
  changeSetting(chosen, 'screenShake', 1);
  assert.equal(chosen.screenShake, 'off');
  changeSetting(chosen, 'screenShake', -1);
  assert.equal(chosen.screenShake, 'full');
  changeSetting(chosen, 'reduceFlashes', 1);
  assert.equal(chosen.reduceFlashes, true);
});

test('screen shake off, low and full move the picture by different amounts', () => {
  function offsetFor(screenShake) {
    let offset;
    withSettings({ screenShake }, () => {
      const shake = new ScreenShake();
      shake.start(8, 10, 1, 0);
      offset = shake.offset.x;
    });
    return offset;
  }

  assert.equal(offsetFor('off'), 0);
  assert.equal(offsetFor('low'), 4);
  assert.equal(offsetFor('full'), 8);
});

function recordingContext() {
  const context = {
    globalAlpha: 1,
    alphaOfEachDraw: [],
    fillRect() {
      this.alphaOfEachDraw.push(this.globalAlpha);
    },
    drawImage() {
      this.alphaOfEachDraw.push(this.globalAlpha);
    },
  };
  return context;
}

test('reduce flashes softens the clash flash', () => {
  function firstFlashAlpha(reduceFlashes) {
    let alpha;
    withSettings({ reduceFlashes }, () => {
      const events = new EventEmitter();
      const clashSparks = new ClashSparks();
      clashSparks.attach(
        events,
        () => [],
        () => 0,
      );
      events.emit('shove-clash', { x: 100, y: 50, playerIds: [] });
      const context = recordingContext();
      drawClashSparks(context, { clashSparks, tickCount: 0 });
      alpha = context.alphaOfEachDraw[0];
    });
    return alpha;
  }

  assert.equal(firstFlashAlpha(false), 1);
  assert.ok(firstFlashAlpha(true) < 1);
});

// Records the gain every sound voice is given.
function fakeAudioContext() {
  const context = { voiceGains: [], musicTargets: [], currentTime: 0, sampleRate: 100, state: 'running' };
  const audioParam = () => ({
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime: (target) => context.musicTargets.push(target),
  });
  const node = () => ({ connect() {}, gain: audioParam(), frequency: audioParam(), pan: audioParam() });
  context.destination = node();
  context.createGain = () => node();
  context.createStereoPanner = node;
  context.createOscillator = () => ({ ...node(), start() {}, stop() {} });
  context.createBufferSource = () => ({ ...node(), start() {}, stop() {} });
  context.createBuffer = () => ({ getChannelData: () => new Float32Array(100) });
  return context;
}

function voiceGainsWith(effectsVolume) {
  let gainValues;
  withSettings({ effectsVolume }, () => {
    const audioContext = fakeAudioContext();
    const gains = [];
    const createGain = audioContext.createGain;
    audioContext.createGain = () => {
      const gain = createGain();
      gains.push(gain);
      return gain;
    };
    const soundPlayer = new SoundPlayer({
      soundDefinitions: {
        hit: [{ waveform: 'square', startFrequency: 100, endFrequency: 50, duration: 1, volume: 0.5 }],
      },
      eventSounds: {},
      createAudioContext: () => audioContext,
    });
    soundPlayer.unlock();
    soundPlayer.play('hit');
    gainValues = gains.map((gain) => gain.gain.value);
  });
  return gainValues;
}

test('the effects volume scales how loud a sound plays, and zero is silent', () => {
  assert.ok(voiceGainsWith(10).includes(0.5));
  assert.ok(voiceGainsWith(5).includes(0.25));
  assert.deepEqual(voiceGainsWith(0), []);
});

test('the music volume scales the music level', () => {
  function musicTargetFor(musicVolume) {
    let target;
    withSettings({ musicVolume }, () => {
      const audioContext = fakeAudioContext();
      const soundPlayer = new SoundPlayer({
        soundDefinitions: {},
        eventSounds: {},
        createAudioContext: () => audioContext,
      });
      soundPlayer.unlock();
      const musicPlayer = new MusicPlayer({ soundPlayer, tracks: {} });
      musicPlayer.pump();
      target = audioContext.musicTargets.at(-1);
    });
    return target;
  }

  const full = musicTargetFor(10);
  assert.ok(full > 0);
  assert.equal(musicTargetFor(5), full / 2);
  assert.equal(musicTargetFor(0), 0);
});

function neutralInputs() {
  const noInput = { left: false, right: false, jump: false, up: false, down: false, confirm: false, pause: false };
  return { red: { ...noInput }, blue: { ...noInput } };
}

function inputsWith(overrides) {
  const inputs = neutralInputs();
  inputs.red = { ...inputs.red, ...overrides };
  return inputs;
}

function press(scene, overrides) {
  scene.update(inputsWith(overrides));
  scene.update(neutralInputs());
}

test('the title Settings screen changes a setting, saves it and closes without starting a game', () => {
  const storage = fakeStorage();
  const scenes = [];
  const sceneManager = { setScene: (scene) => scenes.push(scene), soundPlayer: { storage } };
  const scene = new TitleScene({ sceneManager, levels: [], sprites: {} });
  const saved = { ...settings };
  try {
    scene.selectedIndex = scene.options.findIndex((option) => option.id === 'settings');
    press(scene, { confirm: true });
    assert.ok(scene.settingsMenu);

    press(scene, { right: true });
    press(scene, { jump: true });
    assert.equal(settings.effectsVolume, 0);
    assert.equal(loadSettings(storage).effectsVolume, 0);

    press(scene, { action: true });
    assert.equal(scene.settingsMenu, null);
    assert.equal(scenes.length, 0);
  } finally {
    Object.assign(settings, saved);
  }
});

test('the pause menu Settings screen returns to the pause menu', () => {
  const storage = fakeStorage();
  const sceneManager = { setScene() {}, soundPlayer: { storage } };
  const matchScene = { events: new EventEmitter(), phase: 'fight', ticksRemaining: 100, update() {} };
  const scene = new PausableMatchScene({ sceneManager, matchScene });
  const saved = { ...settings };
  try {
    press(scene, { pause: true });
    scene.selectedIndex = scene.pauseMenuOptions.findIndex((option) => option.id === 'settings');
    press(scene, { confirm: true });
    assert.ok(scene.settingsMenu);

    press(scene, { down: true });
    press(scene, { down: true });
    press(scene, { confirm: true });
    assert.equal(settings.screenShake, 'off');

    press(scene, { pause: true });
    assert.equal(scene.settingsMenu, null);
    assert.equal(scene.paused, true);
  } finally {
    Object.assign(settings, saved);
  }
});
