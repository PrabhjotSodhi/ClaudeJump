const HASH_OFFSET = 0x811c9dc5;
const HASH_PRIME = 0x01000193;

const VERSUS_FIELDS = [
  'tickCount',
  'phase',
  'ticksRemaining',
  'winnerId',
  'waterLineY',
  'fightTicks',
  'suddenDeathPhase',
  'ticksUntilCrateSpawn',
  'skipNextReadyPhase',
  'wins',
  'brokenTiles',
  'dashHitPairIds',
  'shoveHitIdsByShoverId',
  'roundNumber',
  'activeModifierId',
  'pendingModifierId',
  'modifierPickerId',
  'modifierOptionIds',
  'modifierHighlight',
  'modifierJumpHeld',
  'ticksUntilBananaDrop',
];

const SURVIVAL_FIELDS = [
  'runTicks',
  'phase',
  'seaY',
  'cameraTopY',
  'nextRocketTick',
  'newBestTick',
  'startPlayerY',
  'lowestPlayerY',
  'jumpHeld',
  'rocketWarnings',
];

// Fixed references that never change during play.
const IGNORED_ENTITY_FIELDS = new Set(['character', 'sprites']);

const RANDOM_FIELDS = ['random', 'rocketRandom', 'crabRandom'];

const floatBuffer = new Float64Array(1);
const floatWords = new Uint32Array(floatBuffer.buffer);

class Hasher {
  constructor() {
    this.hash = HASH_OFFSET;
  }

  foldWord(word) {
    for (let shift = 0; shift < 32; shift += 8) {
      this.hash = Math.imul(this.hash ^ ((word >>> shift) & 0xff), HASH_PRIME) >>> 0;
    }
  }

  foldNumber(number) {
    floatBuffer[0] = number;
    this.foldWord(floatWords[0]);
    this.foldWord(floatWords[1]);
  }

  foldString(text) {
    this.foldWord(text.length);
    for (let index = 0; index < text.length; index++) this.foldWord(text.charCodeAt(index));
  }

  // Numbers, strings, booleans, null, and arrays, sets, maps and plain objects of those, in
  // their insertion order. Each kind gets its own tag so 0, false and '' never collide.
  foldValue(value) {
    if (typeof value === 'number') {
      this.foldWord(1);
      this.foldNumber(value);
    } else if (typeof value === 'string') {
      this.foldWord(2);
      this.foldString(value);
    } else if (typeof value === 'boolean') {
      this.foldWord(value ? 3 : 4);
    } else if (value === null || value === undefined) {
      this.foldWord(5);
    } else if (Array.isArray(value) || value instanceof Set) {
      this.foldWord(6);
      this.foldWord(value.size ?? value.length);
      for (const item of value) this.foldValue(item);
    } else if (value instanceof Map) {
      this.foldWord(7);
      this.foldWord(value.size);
      for (const [key, item] of value) {
        this.foldValue(key);
        this.foldValue(item);
      }
    } else {
      this.foldWord(8);
      for (const [key, item] of Object.entries(value)) {
        this.foldString(key);
        this.foldValue(item);
      }
    }
  }

  foldEntity(entity) {
    this.foldString(entity.constructor.name);
    for (const [key, value] of Object.entries(entity)) {
      if (IGNORED_ENTITY_FIELDS.has(key)) continue;
      this.foldString(key);
      this.foldValue(value);
    }
  }
}

// A 32 bit number summarising everything that affects how the game plays on: entities, timers,
// wins, broken blocks, sea level and the seeded random state. Two scenes fed the same inputs
// from the same seed have the same hash on every browser. Display-only state is left out.
export function stateHash(scene) {
  const hasher = new Hasher();
  const fields = scene.wins ? VERSUS_FIELDS : SURVIVAL_FIELDS;
  for (const field of fields) hasher.foldValue(scene[field]);
  for (const field of RANDOM_FIELDS) hasher.foldValue(scene[field]?.state);
  for (const [groupName, entities] of scene.entityGroups.entitiesByGroupName) {
    hasher.foldString(groupName);
    hasher.foldWord(entities.length);
    for (const entity of entities) hasher.foldEntity(entity);
  }
  return hasher.hash;
}
