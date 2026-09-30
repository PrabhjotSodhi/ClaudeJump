import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHARACTERS, DEFAULT_CHARACTER_BY_PLAYER_ID } from '../src/entities/characters.js';

test('every character has its tag color, and two eyes', () => {
  const tagColorByName = Object.fromEntries(CHARACTERS.map((character) => [character.name, character.tagColor]));

  assert.deepEqual(tagColorByName, {
    claude: '#f77622',
    meta: '#b55088',
    chatgpt: '#f6757a',
    gemini: '#0099db',
    grok: '#c0cbdc',
    deepseek: '#2ce8f5',
    mistral: '#fee761',
  });
  for (const character of CHARACTERS) assert.equal(character.eyeFramePositions.length, 2, character.name);
});

test('red defaults to Claude and blue to Meta AI', () => {
  assert.equal(DEFAULT_CHARACTER_BY_PLAYER_ID.red.name, 'claude');
  assert.equal(DEFAULT_CHARACTER_BY_PLAYER_ID.blue.name, 'meta');
});
