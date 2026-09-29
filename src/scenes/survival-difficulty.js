// Each step is the difficulty at that many pixels climbed. Values between steps are interpolated linearly.
export const DIFFICULTY_STEPS = [
  { heightClimbed: 0, rocketIntervalTicks: 420, crabChance: 0.05, specialPlatformChance: 0.1 },
  { heightClimbed: 3000, rocketIntervalTicks: 240, crabChance: 0.15, specialPlatformChance: 0.3 },
  { heightClimbed: 8000, rocketIntervalTicks: 120, crabChance: 0.3, specialPlatformChance: 0.5 },
];

export function difficultyAt(heightClimbed) {
  const lastStep = DIFFICULTY_STEPS.at(-1);
  if (heightClimbed >= lastStep.heightClimbed) return interpolate(lastStep, lastStep, 0);
  const height = Math.max(heightClimbed, 0);
  const upperIndex = DIFFICULTY_STEPS.findIndex((step) => step.heightClimbed > height);
  const lower = DIFFICULTY_STEPS[upperIndex - 1];
  const upper = DIFFICULTY_STEPS[upperIndex];
  return interpolate(lower, upper, (height - lower.heightClimbed) / (upper.heightClimbed - lower.heightClimbed));
}

function interpolate(lower, upper, fraction) {
  const blend = (key) => lower[key] + (upper[key] - lower[key]) * fraction;
  return {
    rocketIntervalTicks: Math.round(blend('rocketIntervalTicks')),
    crabChance: blend('crabChance'),
    specialPlatformChance: blend('specialPlatformChance'),
  };
}
