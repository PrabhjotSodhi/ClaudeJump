import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildLevel } from '../../src/levels/level-loader.js';

export const harborLevel = buildLevel(
  JSON.parse(readFileSync(fileURLToPath(new URL('../../data/levels/harbor.json', import.meta.url)), 'utf8')),
);
