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
    name: 'meta',
    displayName: 'Meta AI',
    spriteName: 'meta',
    tagColor: '#b55088',
    eyeFramePositions: [
      [4, 5],
      [19, 5],
    ],
  },
  {
    name: 'chatgpt',
    displayName: 'ChatGPT',
    spriteName: 'chatgpt',
    tagColor: '#f6757a',
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

export const DEFAULT_CHARACTER_BY_PLAYER_ID = { red: findCharacter('claude'), blue: findCharacter('meta') };

// The character each seat hovers on when player select opens.
export const HOVER_CHARACTER_BY_PLAYER_ID = {
  ...DEFAULT_CHARACTER_BY_PLAYER_ID,
  green: findCharacter('chatgpt'),
  yellow: findCharacter('mistral'),
};

export const DEFAULT_JOINED_PLAYERS = Object.entries(DEFAULT_CHARACTER_BY_PLAYER_ID).map(([id, character]) => ({
  id,
  character,
}));
