import { BridgePlanks } from '../entities/bridge-planks.js';
import { CraneHook } from '../entities/crane-hook.js';
import { SteamVent } from '../entities/steam-vent.js';

const HAZARD_FACTORIES = {
  'bridge-planks': (definition, context) => new BridgePlanks(definition, context),
  crane: () => new CraneHook(),
  'steam-vent': (definition) => new SteamVent(definition),
};

// Builds the hazards a level lists under `hazards`, each { type, ...options }. A hazard is an entity whose
// update(scene) runs every fight tick and changes the scene itself, for example by knocking players back.
// `context` is { level, random } for hazards that need the level's tiles or the seeded random.
export function createHazards(definitions, context) {
  return definitions.map((definition) => HAZARD_FACTORIES[definition.type](definition, context));
}
