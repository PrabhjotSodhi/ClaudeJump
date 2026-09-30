import { findCharacter } from '../entities/characters.js';

// What the host decides at the start of an online match: { seed, levelName, players: [{ id, characterName }] }.
// It travels as plain data so every device builds the same scene from its own copy of the levels.
export function sendMatchSetup(transport, setup) {
  transport.broadcast({ type: 'match-setup', setup });
}

// Calls `onSetup(setup)` when the host's setup arrives. The callback should build the scene and the
// lockstep session straight away, so no later message is missed.
export function listenForMatchSetup(transport, onSetup) {
  transport.onMessage = (peerId, data) => {
    if (data?.type === 'match-setup') onSetup(data.setup);
  };
}

export function versusSceneOptionsFromSetup(setup, levels) {
  return {
    seed: setup.seed,
    level: levels.find((level) => level.name === setup.levelName),
    players: setup.players.map(({ id, characterName }) => ({ id, character: findCharacter(characterName) })),
  };
}
