// The ways to play a Versus match, in the order the mode choice lists them. `id` is what VersusScene takes as `mode`.
export const MATCH_MODES = [
  { id: 'knockout', name: 'Knockout', description: 'Last one standing wins the round' },
  { id: 'hill', name: 'Hold the hill', description: 'Stand alone in the glowing zone to score' },
];

export function matchModeName(modeId) {
  return MATCH_MODES.find((mode) => mode.id === modeId)?.name ?? MATCH_MODES[0].name;
}
