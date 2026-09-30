import { CraneHook } from '../entities/crane-hook.js';
import { SteamVent } from '../entities/steam-vent.js';

const HAZARD_FACTORIES = {
  crane: () => new CraneHook(),
  'steam-vent': (definition) => new SteamVent(definition),
};

// Builds the hazards a level lists under `hazards`, each { type, ...options }. A hazard is an entity whose
// update(scene) runs every fight tick and changes the scene itself, for example by knocking players back.
export function createHazards(definitions) {
  return definitions.map((definition) => HAZARD_FACTORIES[definition.type](definition));
}
