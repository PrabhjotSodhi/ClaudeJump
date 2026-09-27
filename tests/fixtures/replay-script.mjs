// The exact scripted input sequence the 320x180 and 640x360 replay fixtures are built from.
// Moves, jumps, bumps, stomps and plays cards. Cards are handed out by setting heldCardName
// directly at fixed ticks (see CARD_GRANTS below) rather than through crates, so the sequence
// never depends on where a crate's seeded landing spot falls.
export const REPLAY_SEED = 12345;
export const REPLAY_TOTAL_TICKS = 1800;
export const REPLAY_RECORD_EVERY_TICKS = 30;

// tick -> { playerId, cardName }, applied before that tick's update() so the following card
// press has something to spend.
const CARD_GRANTS = [
  { tick: 100, playerId: 'red', cardName: 'dash' },
  { tick: 150, playerId: 'blue', cardName: 'rocket' },
  { tick: 900, playerId: 'red', cardName: 'bouncePad' },
  { tick: 1300, playerId: 'blue', cardName: 'fire' },
];

function buildInput({ left = false, right = false, jump = false, down = false, card = false } = {}) {
  return { left, right, jump, down, card, pause: false };
}

function scriptForTick(tick) {
  const red = {};
  const blue = {};

  // Run toward each other, then hold jump long enough to hop up onto the middle platform
  // (the two side platforms sit lower and apart, so this is how they end up on the same one).
  if (tick < 55) {
    red.right = true;
    blue.left = true;
    if (tick >= 10 && tick < 28) {
      red.jump = true;
      blue.jump = true;
    }
  }

  // They meet and bump around tick 47. Then both hold still while blue takes a short hop
  // straight up and back down onto red's head, landing a stomp.
  if (tick >= 55 && tick < 75) {
    red.right = false;
    blue.left = false;
    if (tick === 55) blue.jump = true;
  }

  // Resume moving toward each other after the stomp settles.
  if (tick >= 75 && tick < 100) {
    red.right = true;
    blue.left = true;
  }

  // Play the dash card granted at tick 100.
  if (tick === 105) red.card = true;
  // Play the rocket card granted at tick 150.
  if (tick === 155) blue.card = true;

  // General wandering: both walk back and forth and hop periodically.
  if (tick >= 200 && tick < 900) {
    red.right = tick % 80 < 40;
    red.left = !red.right;
    blue.right = tick % 65 < 32;
    blue.left = !blue.right;
    if (tick % 22 === 0) red.jump = true;
    if (tick % 27 === 0) blue.jump = true;
  }

  // Play the bouncePad card granted at tick 900.
  if (tick === 905) red.card = true;

  if (tick >= 950 && tick < 1300) {
    red.left = tick % 70 < 35;
    red.right = !red.left;
    blue.left = tick % 45 < 22;
    blue.right = !blue.left;
    if (tick % 19 === 0) red.jump = true;
    if (tick % 31 === 0) blue.jump = true;
  }

  // Play the fire card granted at tick 1300.
  if (tick === 1305) blue.card = true;

  if (tick >= 1300 && tick < REPLAY_TOTAL_TICKS) {
    red.right = tick % 50 < 25;
    red.left = !red.right;
    blue.left = tick % 60 < 30;
    blue.right = !blue.left;
    if (tick % 24 === 0) red.jump = true;
    if (tick % 36 === 0) blue.jump = true;
  }

  return { red: buildInput(red), blue: buildInput(blue) };
}

// Runs the scripted replay against the given VersusScene class (so the same script can drive
// both the 320x180 and 640x360 versions of the game). Returns the snapshots recorded every
// REPLAY_RECORD_EVERY_TICKS ticks and every notable event the scene emitted, tagged with its tick.
export function runScriptedReplay(VersusScene) {
  const scene = new VersusScene({ startInFightPhase: true, seed: REPLAY_SEED });
  const events = [];
  for (const eventName of [
    'players-bumped',
    'player-stomped',
    'card-played',
    'card-picked-up',
    'round-won',
    'player-fell-in-water',
    'player-wrapped',
  ]) {
    scene.events.on(eventName, (data) => events.push({ tick: scene.tickCount, eventName, data }));
  }

  const grantsByTick = new Map();
  for (const grant of CARD_GRANTS) grantsByTick.set(grant.tick, grant);

  const snapshots = [];
  for (let tick = 0; tick < REPLAY_TOTAL_TICKS; tick++) {
    const grant = grantsByTick.get(tick);
    if (grant) {
      const player = scene.players.find((candidate) => candidate.id === grant.playerId);
      if (player) player.heldCardName = grant.cardName;
    }

    scene.update(scriptForTick(tick));

    if ((tick + 1) % REPLAY_RECORD_EVERY_TICKS === 0) {
      const red = scene.players.find((player) => player.id === 'red');
      const blue = scene.players.find((player) => player.id === 'blue');
      snapshots.push({
        tick: tick + 1,
        red: { x: red.x, y: red.y },
        blue: { x: blue.x, y: blue.y },
      });
    }
  }

  return { snapshots, events };
}
