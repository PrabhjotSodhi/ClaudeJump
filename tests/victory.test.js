import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { KNOCKOUT_SLOWMO_TICKS, ROUND_COUNTDOWN_TICKS } from '../src/engine/config.js';
import { MusicPlayer } from '../src/engine/music-player.js';
import { channelTokens, HIGHEST_SEMITONE, LOWEST_SEMITONE, parseChannel } from '../src/engine/music-sequencer.js';
import { SoundPlayer } from '../src/engine/sound-player.js';
import { CHARACTERS } from '../src/entities/characters.js';
import { PLAYERS } from '../src/levels/versus-arena.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { CHARACTER_ACTIONS } from '../src/vfx/character-animations.js';
import { harborLevel } from './fixtures/harbor-level.mjs';

const readJson = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const POSES = Object.fromEntries(
  CHARACTER_ACTIONS.map((action) => [action, readJson(`data/images/entities/player/${action}/frames.json`)]),
);
POSES.victory = Object.fromEntries(
  CHARACTERS.map(({ name }) => [name, readJson(`data/images/entities/player/victory/${name}.json`)]),
);
const JINGLES = readJson('data/music/win-jingles.json');
const MAX_JINGLE_SECONDS = 4;

function idleInputs(scene) {
  return Object.fromEntries(scene.players.map((player) => [player.id, { left: false, right: false, jump: false }]));
}

function advance(scene, tickCount) {
  for (let tick = 0; tick < tickCount; tick++) scene.update(idleInputs(scene));
}

// Blue, playing Muse, wins the round by staying dry while red falls in.
function sceneAfterBlueWinsRound({ matchPoint = false } = {}) {
  const players = PLAYERS.slice(0, 2).map(({ id }, index) => ({ id, character: CHARACTERS[index] }));
  const scene = new VersusScene({ level: harborLevel, seed: 0, players, sprites: { characterPoses: POSES } });
  const matchWins = [];
  scene.events.on('match-won', (event) => matchWins.push(event));
  if (matchPoint) scene.wins.blue = scene.winsNeeded - 1;
  advance(scene, ROUND_COUNTDOWN_TICKS);
  scene.players.find((player) => player.id === 'red').y = 600;
  advance(scene, KNOCKOUT_SLOWMO_TICKS + 2);
  return { scene, matchWins };
}

test('every character has its own looping victory pose', () => {
  const poses = CHARACTERS.map(({ name }) => POSES.victory[name]);
  for (const pose of poses) assert.ok(pose.frames.length > 1 && pose.ticksPerFrame > 0);
  assert.equal(new Set(poses.map((pose) => JSON.stringify(pose))).size, CHARACTERS.length);
});

test('the round winner strikes their victory pose and the loser does not', () => {
  const { scene } = sceneAfterBlueWinsRound();
  const blue = scene.players.find((player) => player.id === 'blue');
  const red = scene.players.find((player) => player.id === 'red');

  assert.equal(scene.phase, 'point');
  assert.equal(scene.characterAnimations.stateFor('blue').action, 'victory');
  assert.notEqual(scene.characterAnimations.stateFor('red').action, 'victory');
  assert.ok(POSES.victory.muse.frames.includes(scene.characterAnimations.poseFor(blue)));
  assert.ok(red.inWater);
});

test('winning the match names the winner once and rains confetti in their player color', () => {
  const { scene, matchWins } = sceneAfterBlueWinsRound({ matchPoint: true });
  advance(scene, 30);

  assert.equal(scene.phase, 'match');
  assert.deepEqual(matchWins, [{ playerId: 'blue', characterName: 'muse' }]);
  const blueColor = PLAYERS.find(({ id }) => id === 'blue').color;
  const colors = new Set(scene.confetti.pieces.map((piece) => piece.color));
  assert.ok(scene.confetti.pieces.length > 0);
  assert.ok(colors.has(blueColor));
  assert.ok([...colors].every((color) => color === blueColor || color === '#ffffff'));
});

test('a round that does not win the match brings no confetti', () => {
  const { scene, matchWins } = sceneAfterBlueWinsRound();

  assert.deepEqual(matchWins, []);
  assert.equal(scene.confetti.pieces.length, 0);
});

test('every character has a short win jingle with valid notes', () => {
  for (const { name } of CHARACTERS) {
    const jingle = JINGLES[name];
    const stepCount = jingle.bars * jingle.beatsPerBar * jingle.stepsPerBeat;
    assert.ok((stepCount * 60) / (jingle.tempo * jingle.stepsPerBeat) <= MAX_JINGLE_SECONDS, `${name} is short`);
    for (const channel of Object.values(jingle.channels)) {
      assert.equal(channelTokens(channel).length, stepCount, name);
      if (channel.drums) continue;
      for (const step of parseChannel(channel).filter(Boolean))
        assert.ok(step.semitones >= LOWEST_SEMITONE && step.semitones <= HIGHEST_SEMITONE, name);
    }
  }
});

function fakeAudioContext() {
  const context = { startTimes: [], currentTime: 0, sampleRate: 100, state: 'running' };
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
  const source = () => ({ ...node(), start: (time) => context.startTimes.push(time), stop() {} });
  context.createOscillator = source;
  context.createBufferSource = source;
  context.createBuffer = () => ({ getChannelData: () => new Float32Array(100) });
  return context;
}

test('the winner plays their jingle once, then it stops', () => {
  const audioContext = fakeAudioContext();
  const soundPlayer = new SoundPlayer({
    soundDefinitions: {},
    eventSounds: {},
    createAudioContext: () => audioContext,
    storage: { getItem: () => null, setItem() {} },
  });
  soundPlayer.unlock();
  const musicPlayer = new MusicPlayer({ soundPlayer, tracks: {}, jingles: JINGLES });
  const { scene } = sceneAfterBlueWinsRound();
  musicPlayer.attach(scene.events);

  scene.events.emit('match-won', { playerId: 'blue', characterName: 'muse' });
  const pumpFor = (seconds) => {
    const endTime = audioContext.currentTime + seconds;
    while (audioContext.currentTime < endTime) {
      musicPlayer.pump();
      audioContext.currentTime += 0.05;
    }
  };
  pumpFor(MAX_JINGLE_SECONDS + 1);
  const notesPlayed = audioContext.startTimes.length;
  pumpFor(5);

  const jingleNotes = Object.values(JINGLES.muse.channels)
    .flatMap((channel) => parseChannel(channel).filter((step, index, steps) => step && steps[index - 1] !== step))
    .flatMap((step) => (Array.isArray(step) ? step : [step])).length;
  assert.ok(notesPlayed > 0);
  assert.ok(notesPlayed <= jingleNotes * 2, 'played through once');
  assert.equal(audioContext.startTimes.length, notesPlayed, 'nothing more after it ends');
  assert.equal(musicPlayer.oneShotSequencer, null);
});
