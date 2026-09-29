// eyeFramePositions are the top left of each eye in the character's 32x32 sprite frame, placed to leave the
// character's signature shape visible.
export const CHARACTERS = [
  {
    name: 'claude',
    displayName: 'Claude',
    spriteName: 'claude',
    tagColor: '#f77622',
    eyeFramePositions: [
      [7, 8],
      [16, 8],
    ],
  },
  {
    name: 'muse',
    displayName: 'Muse',
    spriteName: 'muse',
    tagColor: '#ead4aa',
    eyeFramePositions: [
      [7, 6],
      [16, 6],
    ],
  },
  {
    name: 'chatgpt',
    displayName: 'ChatGPT',
    spriteName: 'chatgpt',
    tagColor: '#63c74d',
    eyeFramePositions: [
      [6, 5],
      [17, 5],
    ],
  },
  {
    name: 'gemini',
    displayName: 'Gemini',
    spriteName: 'gemini',
    tagColor: '#0099db',
    eyeFramePositions: [
      [7, 11],
      [16, 11],
    ],
  },
  {
    name: 'grok',
    displayName: 'Grok',
    spriteName: 'grok',
    tagColor: '#c0cbdc',
    eyeFramePositions: [
      [4, 8],
      [12, 5],
    ],
  },
  {
    name: 'deepseek',
    displayName: 'DeepSeek',
    spriteName: 'deepseek',
    tagColor: '#2ce8f5',
    eyeFramePositions: [
      [4, 13],
      [12, 13],
    ],
  },
  {
    name: 'mistral',
    displayName: 'Mistral',
    spriteName: 'mistral',
    tagColor: '#fee761',
    eyeFramePositions: [
      [7, 12],
      [18, 12],
    ],
  },
];

export function findCharacter(name) {
  return CHARACTERS.find((character) => character.name === name);
}

export const DEFAULT_CHARACTER_BY_PLAYER_ID = { red: findCharacter('claude'), blue: findCharacter('muse') };
