import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildLevel } from '../../src/levels/level-loader.js';

const levelsDirectory = fileURLToPath(new URL('../../data/levels/', import.meta.url));

// Every level file in data/levels, keyed by file name without .json.
export const arenaLevels = Object.fromEntries(
  readdirSync(levelsDirectory).map((fileName) => [
    fileName.replace('.json', ''),
    buildLevel(JSON.parse(readFileSync(levelsDirectory + fileName, 'utf8'))),
  ]),
);
