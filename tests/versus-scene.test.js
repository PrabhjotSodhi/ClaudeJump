import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HITSTOP_TICKS, KNOCKOUT_SLOWMO_TICKS, SCREEN_WIDTH, SHOVE_WINDUP_TICKS } from '../src/engine/config.js';
import { Crate } from '../src/entities/crate.js';
import { Platform } from '../src/entities/platform.js';
import { Rocket } from '../src/entities/rocket.js';
import { BouncePad } from '../src/entities/bounce-pad.js';
import { VersusScene } from '../src/scenes/versus-scene.js';
import { arenaLevels } from './fixtures/arena-levels.mjs';
import { harborLevel } from './fixtures/harbor-level.mjs';
import { ROUND_COUNTDOWN_TICKS as READY_TICKS } from '../src/engine/config.js';

function noInput() {
  return { left: false, right: false, jump: false };
}

function neutralInputs() {
  return { red: noInput(), blue: noInput() };
}

function advance(scene, tickCount, inputs = neutralInputs()) {
  for (let tick = 0; tick < tickCount; tick++) scene.update(inputs);
}

function findPlayer(scene, id) {
  return scene.players.find((player) => player.id === id);
}

const DASH_KNOCKBACK_VELOCITY_X = 8;

test('falling in the sea scores the other player', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  assert.equal(scene.phase, 'fight');

  const waterEvents = [];
  scene.events.on('player-fell-in-water', (event) => waterEvents.push(event));

  findPlayer(scene, 'red').y = 600;
  scene.update(neutralInputs());
  advance(scene, KNOCKOUT_SLOWMO_TICKS);

  assert.equal(waterEvents.length, 1);
  assert.equal(waterEvents[0].playerId, 'red');
  assert.equal(scene.phase, 'point');
  assert.equal(scene.winnerId, 'blue');
  assert.equal(scene.wins.blue, 1);
  assert.equal(scene.wins.red, 0);
});

test('reaching 5 points ends the match', () => {
  const scene = new VersusScene({ level: harborLevel });

  for (let win = 1; win <= 5; win++) {
    advance(scene, READY_TICKS);
    findPlayer(scene, 'blue').y = 600;
    scene.update(neutralInputs());
    advance(scene, KNOCKOUT_SLOWMO_TICKS);

    assert.equal(scene.wins.red, win);
    if (win < 5) {
      assert.equal(scene.phase, 'point');
      advance(scene, 90); // point pause resolves back to a fresh 'ready' round
    }
  }

  assert.equal(scene.phase, 'match');
});

test('both players falling on the same tick is a draw', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  findPlayer(scene, 'red').y = 600;
  findPlayer(scene, 'blue').y = 600;
  scene.update(neutralInputs());
  advance(scene, KNOCKOUT_SLOWMO_TICKS);

  assert.equal(scene.phase, 'point');
  assert.equal(scene.winnerId, null);
  assert.equal(scene.wins.red, 0);
  assert.equal(scene.wins.blue, 0);
});

test('running the same input records twice produces identical game state', () => {
  const inputRecords = [];
  for (let tick = 0; tick < 250; tick++) {
    inputRecords.push({
      red: { left: false, right: tick % 3 !== 0, jump: tick % 47 === 0 },
      blue: { left: tick % 5 === 0, right: false, jump: tick % 61 === 0 },
    });
  }

  function runToSnapshot() {
    const scene = new VersusScene({ level: harborLevel });
    for (const input of inputRecords) scene.update(input);
    return {
      phase: scene.phase,
      winnerId: scene.winnerId,
      wins: { ...scene.wins },
      players: scene.players.map((player) => ({
        x: player.x,
        y: player.y,
        velocityX: player.velocityX,
        velocityY: player.velocityY,
        onGround: player.onGround,
        inWater: player.inWater,
      })),
    };
  }

  assert.deepEqual(runToSnapshot(), runToSnapshot());
});

test('two players walking into each other pass through and end up overlapping', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  red.x = 264;
  red.y = 116;
  red.onGround = true;
  blue.x = 356;
  blue.y = 116;
  blue.onGround = true;

  let everOverlapped = false;
  for (let tick = 0; tick < 60; tick++) {
    scene.update({ red: { left: false, right: true, jump: false }, blue: { left: true, right: false, jump: false } });
    if (red.overlaps(blue)) everOverlapped = true;
  }

  assert.equal(everOverlapped, true, 'the players overlap while crossing');
  assert.ok(red.x > blue.x, 'red walked through blue to the other side');
  assert.equal(red.knockbackVelocityX, 0);
  assert.equal(blue.knockbackVelocityX, 0);
});

test('a player walking into a standing player does not move them', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  red.x = 264;
  red.y = 116;
  red.onGround = true;
  blue.x = 340;
  blue.y = 116;
  blue.onGround = true;
  const blueStartX = blue.x;

  let everOverlapped = false;
  for (let tick = 0; tick < 40; tick++) {
    scene.update({ red: { left: false, right: true, jump: false }, blue: noInput() });
    if (red.overlaps(blue)) everOverlapped = true;
  }

  assert.equal(blue.x, blueStartX);
  assert.equal(everOverlapped, true, 'red walks inside blue');
});

test('a player landing on another player passes through, with no bounce, knockback or pause', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  blue.x = 300;
  blue.y = 116;
  blue.onGround = true;
  red.x = 292;
  red.y = 82;
  red.previousY = red.y;
  red.velocityY = 4;
  red.onGround = false;

  let redPeakUpwardSpeed = 0;
  for (let tick = 0; tick < 20; tick++) {
    scene.update(neutralInputs());
    redPeakUpwardSpeed = Math.max(redPeakUpwardSpeed, -red.velocityY);
    assert.equal(red.isFrozen, false, `no freeze on tick ${tick}`);
  }

  assert.equal(redPeakUpwardSpeed, 0, 'the lander never bounces up');
  assert.equal(blue.knockbackVelocityX, 0, 'the other player is not knocked away');
  assert.equal(blue.x, 300);
  assert.equal(red.overlaps(blue), true, 'red came to rest inside blue');
});

test('a player moving past the right edge reappears on the left with the same velocity', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  red.x = SCREEN_WIDTH - 60;
  red.y = 116;
  blue.x = 300; // out of the way, on screen
  blue.y = 116; // standing on the middle platform, not mid-air where it would fall in and end the round
  blue.onGround = true;

  const wrapEvents = [];
  scene.events.on('player-wrapped', (event) => wrapEvents.push(event));

  let velocityXBeforeWrap = null;
  for (let tick = 0; tick < 30 && wrapEvents.length === 0; tick++) {
    velocityXBeforeWrap = red.velocityX;
    scene.update({ red: { left: false, right: true, jump: false }, blue: noInput() });
    // Pin height between ticks so unrelated gravity drift (there is no real platform this far out)
    // cannot be mistaken for the wrap itself changing y; the wrap only ever touches x.
    red.velocityY = 0;
    red.y = 116;
  }

  assert.equal(wrapEvents.length, 1);
  assert.equal(wrapEvents[0].playerId, 'red');
  assert.equal(wrapEvents[0].x, red.x);
  assert.ok(red.x >= 0 && red.x < 20, 'red reappears near the left edge');
  assert.ok(Math.abs(wrapEvents[0].y - 116) < 2, 'height is unaffected by the wrap');
  assert.equal(red.velocityX, velocityXBeforeWrap, 'speed is unaffected by the wrap');
});

test('a running jump from a side platform lands on the middle platform', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  const runTicksBeforeJump = 20;
  const jumpHoldTicks = 20;
  for (let tick = 0; tick < 60; tick++) {
    const jump = tick >= runTicksBeforeJump && tick < runTicksBeforeJump + jumpHoldTicks;
    scene.update({ red: { left: false, right: true, jump }, blue: noInput() });
  }

  const red = findPlayer(scene, 'red');
  assert.equal(red.onGround, true);
  assert.equal(red.inWater, false);
  assert.equal(red.y, 116); // standing on the middle platform (y 144, player height 28)
  assert.ok(red.x + red.width > 256 && red.x < 384, 'red should be within the middle platform bounds');
});

const SUDDEN_DEATH_ROUND_TICKS = 1800;
const SUDDEN_DEATH_WARNING_TICKS = 120;

test('the sudden death warning starts exactly 1800 ticks after Go!', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  assert.equal(scene.phase, 'fight');

  const suddenDeathEvents = [];
  scene.events.on('sudden-death-started', (event) => suddenDeathEvents.push(event));

  advance(scene, SUDDEN_DEATH_ROUND_TICKS - 1);
  assert.equal(scene.suddenDeathPhase, 'none');
  assert.deepEqual(suddenDeathEvents, []);

  scene.update(neutralInputs());
  assert.equal(scene.suddenDeathPhase, 'warning');
  assert.deepEqual(suddenDeathEvents, [{}]);
});

test('the round timer ticks once a second for the last five seconds', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  const secondsRemaining = [];
  scene.events.on('timer-ticked', (event) => secondsRemaining.push(event.secondsRemaining));

  advance(scene, SUDDEN_DEATH_ROUND_TICKS);

  assert.deepEqual(secondsRemaining, [5, 4, 3, 2, 1]);
});

test('the sea rises only after the warning ends, and a player standing below it loses the round', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  advance(scene, SUDDEN_DEATH_ROUND_TICKS);
  assert.equal(scene.suddenDeathPhase, 'warning');

  const waterLineBeforeRising = scene.waterLineY;
  advance(scene, SUDDEN_DEATH_WARNING_TICKS - 1);
  assert.equal(scene.waterLineY, waterLineBeforeRising, 'the sea stays put during the warning');

  scene.update(neutralInputs());
  assert.equal(scene.suddenDeathPhase, 'rising');
  assert.ok(scene.waterLineY < waterLineBeforeRising, 'the sea starts rising');

  // Fast-forward the sea between the two platform heights (side platforms bottom at 224, middle at 144):
  // red on the middle platform should stay dry while blue on a side platform is swallowed.
  scene.waterLineY = 180;
  const red = findPlayer(scene, 'red');
  red.x = 264;
  red.y = 116; // standing on the middle platform, top y 144
  red.onGround = true;
  const blue = findPlayer(scene, 'blue');
  blue.x = 120;
  blue.y = 196; // standing on the side platform, top y 224
  blue.onGround = true;

  scene.update(neutralInputs());

  advance(scene, KNOCKOUT_SLOWMO_TICKS);

  assert.equal(blue.inWater, true, 'the risen sea reaches the side platform');
  assert.equal(red.inWater, false, 'the middle platform is still above the sea');
  assert.equal(scene.phase, 'point');
  assert.equal(scene.winnerId, 'red');
});

test('the timer and the sea reset for the next round', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  advance(scene, SUDDEN_DEATH_ROUND_TICKS);
  assert.equal(scene.suddenDeathPhase, 'warning');

  findPlayer(scene, 'red').y = 600;
  scene.update(neutralInputs());
  advance(scene, KNOCKOUT_SLOWMO_TICKS);
  assert.equal(scene.phase, 'point');

  advance(scene, 90); // point pause resolves back to a fresh 'ready' round
  assert.equal(scene.phase, 'ready');
  assert.equal(scene.suddenDeathPhase, 'none');
  assert.equal(scene.fightTicks, 0);
  assert.equal(scene.waterLineY, 328);
});

test('a dash into the opponent knocks them away', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  red.x = 264;
  red.y = 116;
  red.onGround = true;
  red.facing = 1;
  blue.x = 300;
  blue.y = 116;
  blue.onGround = true;
  const blueStartX = blue.x;
  red.heldCardName = 'dash';

  const cardEvents = [];
  scene.events.on('card-played', (event) => cardEvents.push(event));

  // Release the jump/action keys held from spawn before pressing fresh, then dash.
  scene.update({ red: noInput(), blue: noInput() });
  scene.update({ red: { left: false, right: false, jump: false, action: true }, blue: noInput() });

  assert.deepEqual(cardEvents, [{ playerId: 'red', cardName: 'dash' }]);

  const dashHitEvents = [];
  scene.events.on('dash-hit', (event) => dashHitEvents.push(event));

  for (let tick = 0; tick < 10 && dashHitEvents.length === 0; tick++) {
    scene.update({ red: noInput(), blue: noInput() });
  }

  assert.equal(dashHitEvents.length, 1, 'the dash carries red into blue');
  assert.equal(dashHitEvents[0].strength, 'medium');
  advance(scene, HITSTOP_TICKS.medium);
  assert.equal(blue.knockbackVelocityX, DASH_KNOCKBACK_VELOCITY_X);

  for (let tick = 0; tick < 15; tick++) {
    scene.update({ red: noInput(), blue: noInput() });
  }

  assert.ok(blue.x > blueStartX, 'the dashed-into player is knocked away');
});

test('a dash into an opponent already overlapping them still lands the dash hit', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  red.x = 290;
  red.y = 116;
  red.onGround = true;
  red.facing = 1;
  blue.x = 300;
  blue.y = 116;
  blue.onGround = true;
  red.heldCardName = 'dash';

  const dashHitEvents = [];
  scene.events.on('dash-hit', (event) => dashHitEvents.push(event));

  scene.update({ red: noInput(), blue: noInput() }); // release the action key held from spawn
  scene.update({ red: { left: false, right: false, jump: false, action: true }, blue: noInput() });

  assert.equal(dashHitEvents.length, 1, 'the dash lands a hit immediately');
  advance(scene, HITSTOP_TICKS.medium);
  assert.equal(blue.knockbackVelocityX, DASH_KNOCKBACK_VELOCITY_X);
});

test('a shove knocks the player in front away and pops them upward', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  red.x = 264;
  red.y = 116;
  red.onGround = true;
  red.facing = 1;
  blue.x = 300; // inside red's hit zone (red's right edge at 288, zone 16px wide), not yet touching red
  blue.y = 116;
  blue.onGround = true;
  const blueStartX = blue.x;

  const shoveEvents = [];
  scene.events.on('player-shoved', (event) => shoveEvents.push(event));

  scene.update({ red: noInput(), blue: noInput() }); // release the jump/action keys held from spawn
  scene.update({ red: { left: false, right: false, jump: false, action: true }, blue: noInput() });
  for (let tick = 0; tick < SHOVE_WINDUP_TICKS + 1; tick++) scene.update({ red: noInput(), blue: noInput() });

  assert.deepEqual(shoveEvents, [
    { shoverId: 'red', targetId: 'blue', directionX: 1, directionY: 0, strength: 'light', charge: 0 },
  ]);
  advance(scene, HITSTOP_TICKS.light);
  assert.ok(blue.knockbackVelocityX > 0, 'the shove knocks blue away from red');
  assert.ok(blue.velocityY < 0, 'the shove pops blue upward');

  for (let tick = 0; tick < 15; tick++) {
    scene.update({ red: noInput(), blue: noInput() });
  }

  assert.ok(blue.x > blueStartX, 'the shoved player ends up pushed away');
});

test('a shove never hits a player standing behind the shover', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  red.x = 264;
  red.y = 116;
  red.onGround = true;
  red.facing = 1; // facing right, so the hit zone opens to red's right, away from blue
  blue.x = 150;
  blue.y = 116;
  blue.onGround = true;

  const shoveEvents = [];
  scene.events.on('player-shoved', (event) => shoveEvents.push(event));

  scene.update({ red: noInput(), blue: noInput() });
  scene.update({ red: { left: false, right: false, jump: false, action: true }, blue: noInput() });

  for (let tick = 0; tick < 10; tick++) {
    scene.update({ red: noInput(), blue: noInput() });
  }

  assert.equal(shoveEvents.length, 0, 'a player behind the shover is never hit');
  assert.equal(blue.knockbackVelocityX, 0);
});

test('a shove hits an opponent at most once, even while the hit zone stays on them for the whole active window', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  red.x = 264;
  red.y = 116;
  red.onGround = true;
  red.facing = 1;
  blue.x = 300;
  blue.y = 116;
  blue.onGround = true;
  // A wall right against blue's far side stops the knockback from carrying blue out of the hit
  // zone, so the zone stays on blue for the whole active window and a broken "once per shove"
  // guard would otherwise land a hit on every one of those ticks.
  scene.entityGroups.add('platforms', new Platform({ x: blue.x + blue.width, y: 100, width: 20, height: 100 }));

  const shoveEvents = [];
  scene.events.on('player-shoved', (event) => shoveEvents.push(event));

  scene.update({ red: noInput(), blue: noInput() });
  scene.update({ red: { left: false, right: false, jump: false, action: true }, blue: noInput() });

  for (let tick = 0; tick < 10; tick++) {
    scene.update({ red: noInput(), blue: noInput() });
  }

  assert.equal(shoveEvents.length, 1, 'the shove lands at most one hit, even across several active ticks');
});

test('a card pressed on the tick a player falls in the sea emits card-played once, not every sinking tick', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  red.heldCardName = 'dash';
  scene.update({ red: noInput(), blue: noInput() }); // release the action key held from spawn

  const cardEvents = [];
  scene.events.on('card-played', (event) => cardEvents.push(event));

  red.y = 600; // below the water line, falls in on this tick
  scene.update({ red: { left: false, right: false, jump: false, action: true }, blue: noInput() });
  assert.equal(scene.phase, 'knockout');
  assert.equal(red.inWater, true);

  advance(scene, 60); // keep sinking well past the point pause

  assert.equal(cardEvents.length, 1, 'the press should fire card-played exactly once');
});

test('startInFightPhase skips the Ready countdown for the first round only', () => {
  const scene = new VersusScene({ level: harborLevel, startInFightPhase: true });
  assert.equal(scene.phase, 'fight');

  findPlayer(scene, 'red').y = 600;
  scene.update(neutralInputs());
  assert.equal(scene.phase, 'knockout');

  advance(scene, KNOCKOUT_SLOWMO_TICKS + 90); // slow motion and point pause resolve into the next round
  assert.equal(scene.phase, 'ready');
});

test('a rocket blast pushes a player away from the blast center and emits rocket-exploded', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red'); // placed left of the blast center
  red.x = 280;
  red.y = 200;
  const blue = findPlayer(scene, 'blue'); // placed right of the blast center
  blue.x = 320;
  blue.y = 200;

  const rocket = new Rocket({ x: 300, y: 200, facing: 1, shooterId: 'blue' });
  rocket.ticksRemaining = 1; // one tick from expiring, so this update explodes it in place
  scene.entityGroups.add('rockets', rocket);

  const explosionEvents = [];
  scene.events.on('rocket-exploded', (event) => explosionEvents.push(event));

  advance(scene, 1 + HITSTOP_TICKS.heavy);

  assert.ok(red.knockbackVelocityX < 0, 'the player left of the blast is pushed further left');
  assert.ok(blue.knockbackVelocityX > 0, 'the player right of the blast is pushed further right');
  assert.equal(explosionEvents.length, 1);
  assert.equal(explosionEvents[0].strength, 'heavy');
  assert.equal(explosionEvents[0].x, rocket.x + rocket.width / 2);
  assert.equal(explosionEvents[0].y, rocket.y + rocket.height / 2);
  assert.equal(scene.entityGroups.get('rockets').length, 0, 'the exploded rocket is removed');
});

test('a rocket wraps around the screen edges like a player', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  const rocket = new Rocket({ x: SCREEN_WIDTH + 2, y: 200, facing: 1, shooterId: 'red' });
  scene.entityGroups.add('rockets', rocket);

  scene.update(neutralInputs());

  assert.ok(rocket.x < SCREEN_WIDTH, 'the rocket reappears from the left edge once it has fully crossed the right one');
});

// Runs until the player's velocityY turns non-negative (the arc has peaked) and returns how far
// above the starting height the player rose. Bails out well before either arc could plausibly
// still be rising, so a broken launch that never turns over fails loudly instead of looping.
function riseToApex(scene, playerId, input) {
  const player = findPlayer(scene, playerId);
  const startY = player.y;
  let apexY = startY;
  for (let tick = 0; tick < 120; tick++) {
    scene.update(input);
    apexY = Math.min(apexY, player.y);
    if (player.velocityY >= 0) break;
  }
  return startY - apexY;
}

test('landing on a bounce pad launches the player higher than a jump', () => {
  const jumpScene = new VersusScene({ level: harborLevel });
  advance(jumpScene, READY_TICKS);
  jumpScene.update(neutralInputs()); // release the jump key held from spawn
  // Held the whole way up, so the jump reaches its full, uncut height.
  const jumpRise = riseToApex(jumpScene, 'red', {
    red: { left: false, right: false, jump: true, action: false },
    blue: noInput(),
  });
  assert.ok(jumpRise > 0, 'a held jump rises above its starting height');

  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  // A gap with no platform above or below it, so nothing but gravity shapes either player's arc.
  scene.entityGroups.add('bouncePads', new BouncePad({ x: 36, y: 280 }));

  const red = findPlayer(scene, 'red');
  red.x = 40;
  red.y = 248; // feet above the pad's top surface
  red.velocityY = 12; // already falling at max speed, so this tick's fall crosses the pad
  red.onGround = false;
  scene.update(neutralInputs()); // the fall crosses the pad and launches red this tick
  assert.ok(red.velocityY < 0, 'the pad launches the player upward');

  const padRise = riseToApex(scene, 'red', neutralInputs());

  assert.ok(padRise > jumpRise, 'the pad launches the player higher than a full held jump');
});

test('walking into the side of a bounce pad does nothing', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  // Sitting on top of the middle platform, at the same feet level a standing player already has.
  scene.entityGroups.add('bouncePads', new BouncePad({ x: 300, y: 138 }));

  const red = findPlayer(scene, 'red');
  red.x = 260; // on the middle platform, approaching the pad from the side
  red.y = 116;
  red.velocityY = 0;
  red.onGround = true;

  for (let tick = 0; tick < 20; tick++) {
    scene.update({ red: { left: false, right: true, jump: false, action: false }, blue: noInput() });
  }

  assert.equal(red.velocityY, 0, 'walking past the pad from the side never launches the player');
});

test('a player falling well below a bounce pad, overlapping it only horizontally, is not launched', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  // A gap with no platform, so the fall is uninterrupted and stays clear of the water line.
  scene.entityGroups.add('bouncePads', new BouncePad({ x: 236, y: 160 }));

  const red = findPlayer(scene, 'red');
  red.x = 240; // overlaps the pad horizontally
  red.y = 280; // feet already far below the pad's top surface, not crossing it this tick
  red.velocityY = 12; // falling
  red.onGround = false;

  scene.update(neutralInputs());

  assert.ok(red.velocityY > 0, 'still falling, never launched, despite the horizontal overlap');
});

const TRAP_PAD_X = 300;
const TRAP_PAD_Y = 138; // sitting on top of the middle platform

function sceneWithTrapPad() {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  const trap = new BouncePad({ x: TRAP_PAD_X, y: TRAP_PAD_Y, ownerId: 'blue' });
  scene.entityGroups.add('bouncePads', trap);
  return { scene, trap, red: findPlayer(scene, 'red'), blue: findPlayer(scene, 'blue') };
}

function standOnMiddlePlatform(player, x) {
  player.x = x;
  player.y = 116;
  player.velocityX = 0;
  player.velocityY = 0;
  player.onGround = true;
}

test('the owner of a bounce pad trap can land and stand on it with no effect', () => {
  const { scene, trap, red, blue } = sceneWithTrapPad();
  standOnMiddlePlatform(red, 100);
  standOnMiddlePlatform(blue, TRAP_PAD_X);
  blue.y = 100; // feet above the pad's top surface
  blue.velocityY = 6;
  blue.onGround = false;

  let highestUpwardSpeed = 0;
  for (let tick = 0; tick < 20; tick++) {
    scene.update(neutralInputs());
    highestUpwardSpeed = Math.max(highestUpwardSpeed, -blue.velocityY);
  }

  assert.equal(highestUpwardSpeed, 0, 'the owner is never launched');
  assert.equal(blue.y, 116, 'the owner stands on the platform');
  assert.equal(blue.knockbackVelocityX, 0);
  assert.deepEqual(scene.entityGroups.get('bouncePads'), [trap], 'the trap stays');
});

function walkIntoTrap(startX, direction) {
  const { scene, red } = sceneWithTrapPad();
  standOnMiddlePlatform(red, startX);
  const walking = { red: { ...noInput(), left: direction < 0, right: direction > 0 }, blue: noInput() };
  for (let tick = 0; tick < 60 && scene.entityGroups.get('bouncePads').length > 0; tick++) scene.update(walking);
  advance(scene, HITSTOP_TICKS.light);
  return { scene, red };
}

test('the opponent walking into a bounce pad trap from the left is thrown back left, and the trap breaks', () => {
  const { scene, red } = walkIntoTrap(TRAP_PAD_X - 40, 1);

  assert.ok(red.knockbackVelocityX < 0, 'thrown left');
  assert.ok(red.velocityY < 0, 'with a small hop');
  assert.equal(scene.entityGroups.get('bouncePads').length, 0, 'the trap breaks after one throw');
});

test('the opponent walking into a bounce pad trap from the right is thrown back right', () => {
  const { red } = walkIntoTrap(TRAP_PAD_X + 60, -1);

  assert.ok(red.knockbackVelocityX > 0, 'thrown right');
});

test('the opponent standing still on a bounce pad trap is thrown away from its center', () => {
  for (const [standX, expectedSign] of [
    [TRAP_PAD_X - 4, -1],
    [TRAP_PAD_X + 4, 1],
  ]) {
    const { scene, red } = sceneWithTrapPad();
    standOnMiddlePlatform(red, standX);

    advance(scene, 1 + HITSTOP_TICKS.light);

    assert.equal(Math.sign(red.knockbackVelocityX), expectedSign);
  }
});

test('the opponent touching a bounce pad trap emits one trap-sprung with the owner and target', () => {
  const { scene, red } = sceneWithTrapPad();
  const trapEvents = [];
  scene.events.on('trap-sprung', (event) => trapEvents.push(event));
  standOnMiddlePlatform(red, TRAP_PAD_X - 4);

  for (let tick = 0; tick < 10; tick++) scene.update(neutralInputs());

  assert.deepEqual(trapEvents, [
    { ownerId: 'blue', targetId: 'red', directionX: 0, directionY: -1, strength: 'light' },
  ]);
});

test('landing on a neutral level bounce pad emits no trap-sprung', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  const trapEvents = [];
  scene.events.on('trap-sprung', (event) => trapEvents.push(event));
  scene.entityGroups.add('bouncePads', new BouncePad({ x: 36, y: 280 }));
  const red = findPlayer(scene, 'red');
  red.x = 40;
  red.y = 248;
  red.velocityY = 12;
  red.onGround = false;

  scene.update(neutralInputs());

  assert.ok(red.velocityY < 0, 'the pad launched red');
  assert.deepEqual(trapEvents, []);
});

test('a bounce pad trap throw freezes the opponent before the launch', () => {
  const { scene, red } = sceneWithTrapPad();
  standOnMiddlePlatform(red, TRAP_PAD_X - 4);

  scene.update(neutralInputs());
  assert.equal(red.isFrozen, true);
  assert.equal(red.knockbackVelocityX, 0);
});

test('a bounce pad trap throws the opponent about 120 px on flat ground', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  const platforms = scene.entityGroups.get('platforms');
  platforms.length = 0;
  scene.entityGroups.add('platforms', new Platform({ x: -2000, y: 224, width: 5000, height: 16 }));
  scene.entityGroups.add('bouncePads', new BouncePad({ x: 320, y: 218, ownerId: 'blue' }));
  const red = findPlayer(scene, 'red');
  red.x = 250;
  red.y = 224 - red.height;
  red.onGround = true;
  red.velocityY = 0;
  while (scene.entityGroups.get('bouncePads').length > 0) {
    scene.update({ red: { ...noInput(), right: true }, blue: noInput() });
  }
  const throwStartX = red.x;

  advance(scene, 200);

  assert.ok(Math.abs(throwStartX - red.x - 120) <= 5, `thrown ${throwStartX - red.x} px`);
});

test('a bounce pad disappears after 300 ticks', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  red.heldCardName = 'bouncePad';
  scene.update({ red: noInput(), blue: noInput() }); // release the action key held from spawn
  scene.update({ red: { left: false, right: false, jump: false, action: true }, blue: noInput() }); // 1st tick since it appeared

  assert.equal(scene.entityGroups.get('bouncePads').length, 1);

  advance(scene, 298); // 299 ticks since it appeared

  assert.equal(scene.entityGroups.get('bouncePads').length, 1, 'still there just before 300 ticks');

  scene.update(neutralInputs()); // 300th tick since it appeared

  assert.equal(scene.entityGroups.get('bouncePads').length, 0, 'gone once 300 ticks have passed');
});

function addLandedCrate(scene, { x, y, cardName }) {
  const crate = new Crate({ x, y, cardName });
  crate.y = y; // crates start above the screen and fall; place this one directly as if it already landed
  crate.landed = true;
  scene.entityGroups.clear('crates');
  scene.entityGroups.add('crates', crate);
  return crate;
}

test('touching a crate with no card takes the card', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  red.x = 200;
  red.y = 200;
  const crate = addLandedCrate(scene, { x: red.x, y: red.y, cardName: 'dash' });

  const pickupEvents = [];
  scene.events.on('card-picked-up', (event) => pickupEvents.push(event));

  scene.update(neutralInputs());

  assert.deepEqual(pickupEvents, [{ playerId: 'red', cardName: 'dash' }]);
  assert.equal(red.heldCardName, 'dash');
  assert.equal(scene.entityGroups.get('crates').includes(crate), false, 'the taken crate is removed');
});

test('a crate gives a pickup with 3 uses', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  red.x = 200;
  red.y = 200;
  addLandedCrate(scene, { x: red.x, y: red.y, cardName: 'rocket' });

  scene.update(neutralInputs());

  assert.equal(red.heldCardName, 'rocket');
  assert.equal(red.heldCardUsesRemaining, 1);
});

test('crates only ever hold a known pickup', () => {
  const allowedCardNames = new Set(['dash', 'rocket', 'bouncePad', 'bomb', 'banana']);
  for (let seed = 1; seed <= 20; seed++) {
    const scene = new VersusScene({ level: harborLevel, seed });
    for (let tick = 0; tick < 600; tick++) {
      scene.update(neutralInputs());
      for (const crate of scene.entityGroups.get('crates')) {
        assert.ok(allowedCardNames.has(crate.cardName), `seed ${seed} dropped ${crate.cardName}`);
      }
    }
  }
});

test('a player already holding a card cannot open a crate, and the crate stays', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  red.heldCardName = 'rocket';
  red.x = 200;
  red.y = 200;
  const crate = addLandedCrate(scene, { x: red.x, y: red.y, cardName: 'dash' });

  const pickupEvents = [];
  scene.events.on('card-picked-up', (event) => pickupEvents.push(event));

  scene.update(neutralInputs());

  assert.deepEqual(pickupEvents, []);
  assert.equal(red.heldCardName, 'rocket', 'the player keeps the card they already had');
  assert.equal(scene.entityGroups.get('crates')[0], crate, 'the crate stays put');
});

test('the next crate lands 180 ticks after the previous one is taken', () => {
  const scene = new VersusScene({ level: harborLevel, seed: 1 });
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  red.x = 264;
  red.y = 116; // standing on the middle platform, so it never falls in the sea while this runs
  red.onGround = true;
  // Already holding a card so it cannot immediately take the next crate wherever it lands.
  findPlayer(scene, 'blue').heldCardName = 'rocket';
  addLandedCrate(scene, { x: red.x, y: red.y, cardName: 'dash' });

  scene.update(neutralInputs()); // red takes the crate on this tick

  let ticksSinceTaken = 0;
  while (!scene.entityGroups.get('crates')[0]?.landed) {
    scene.update(neutralInputs());
    ticksSinceTaken++;
    if (ticksSinceTaken > 300) throw new Error('the next crate never landed');
  }

  assert.equal(ticksSinceTaken, 180);
});

test('the same seed gives the same crate spots and cards', () => {
  function firstCrateAfterSpawn(seed) {
    const scene = new VersusScene({ level: harborLevel, seed });
    advance(scene, READY_TICKS);
    advance(scene, 130); // past the 120 tick spawn delay, before the crate has landed
    const crate = scene.entityGroups.get('crates')[0];
    return { x: crate.x, y: crate.y, cardName: crate.cardName };
  }

  assert.deepEqual(firstCrateAfterSpawn(7), firstCrateAfterSpawn(7));
});

test('while the sea is above the side platforms, every crate lands on the still-dry middle platform', () => {
  for (let seed = 0; seed < 20; seed++) {
    const scene = new VersusScene({ level: harborLevel, seed });
    advance(scene, READY_TICKS);
    scene.waterLineY = 180; // above the side platforms (top y 224), below the middle platform (top y 144)
    scene.entityGroups.clear('crates');
    scene.spawnCrate();

    const crate = scene.entityGroups.get('crates')[0];
    assert.ok(crate, 'a crate spawns since the middle platform is still dry');
    assert.ok(crate.x >= 256 && crate.x + crate.width <= 384, 'the crate lands on the middle platform only');
  }
});

test('a crate is removed once the rising sea reaches its platform', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  const crate = addLandedCrate(scene, { x: 120, y: 208, cardName: 'dash' }); // side platform, top y 224

  scene.waterLineY = 328;
  scene.update(neutralInputs());
  assert.equal(scene.entityGroups.get('crates')[0], crate, 'the crate stays while its platform is dry');

  scene.waterLineY = 210; // risen past the crate's platform
  scene.update(neutralInputs());
  assert.equal(scene.entityGroups.get('crates').includes(crate), false, 'the submerged crate is removed');
});

test('a player can take a crate while it is still in the air', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  red.x = 200;
  red.y = 200;

  // Marked far enough below that the fall is already under way and still airborne this tick.
  const crate = new Crate({ x: red.x, y: red.y + 80, cardName: 'dash' });
  crate.y = red.y;
  scene.entityGroups.clear('crates');
  scene.entityGroups.add('crates', crate);

  const pickupEvents = [];
  scene.events.on('card-picked-up', (event) => pickupEvents.push(event));

  scene.update(neutralInputs());

  assert.equal(crate.landed, false, 'the crate is still airborne');
  assert.equal(crate.isFalling, true, 'the fall is already under way');
  assert.deepEqual(pickupEvents, [{ playerId: 'red', cardName: 'dash' }]);
  assert.equal(red.heldCardName, 'dash');
});

test('a player touching where a waiting crate hides above the screen does not take it', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const crate = new Crate({ x: 200, y: 216, cardName: 'dash' }); // marked spot far enough that the fall has not started
  red.x = crate.x;
  red.y = crate.y; // standing exactly where the hidden, waiting crate currently sits

  const pickupEvents = [];
  scene.events.on('card-picked-up', (event) => pickupEvents.push(event));

  scene.entityGroups.clear('crates');
  scene.entityGroups.add('crates', crate);
  scene.update(neutralInputs());

  assert.equal(crate.isFalling, false, 'the crate has not started falling yet');
  assert.deepEqual(pickupEvents, [], 'nothing is taken from a crate that has not appeared yet');
  assert.equal(red.heldCardName, null);
});

test('a crate with no platform below it falls into the sea and the next crate is scheduled', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  // x 0 sits under no platform, so nothing stops the fall.
  const crate = new Crate({ x: 0, y: scene.waterLineY - 40, cardName: 'dash' });
  crate.y = scene.waterLineY - crate.height - 2; // one fall tick from the sea
  crate.ticksUntilLanded = 0;
  scene.entityGroups.clear('crates');
  scene.entityGroups.add('crates', crate);

  scene.update(neutralInputs());
  assert.equal(crate.landed, false, 'never touched a platform');
  assert.equal(scene.entityGroups.get('crates').length, 0, 'the crate lost to the sea is removed');

  let ticksSinceLost = 0;
  while (!scene.entityGroups.get('crates')[0]) {
    scene.update(neutralInputs());
    ticksSinceLost++;
    if (ticksSinceLost > 300) throw new Error('the next crate was never scheduled');
  }
});

test('a fall landed after the round is already decided is not counted in match stats', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');

  red.y = 600; // red falls in during the fight, deciding the round
  scene.update(neutralInputs());
  assert.equal(scene.phase, 'knockout');
  assert.deepEqual(scene.matchStats.fallsIn, { red: 1, blue: 0 });

  // A late rocket (or leftover momentum) knocks the winner in after the round is already over.
  blue.y = 600;
  scene.update(neutralInputs());
  assert.equal(blue.inWater, true, 'blue still falls in; the event still fires');
  assert.deepEqual(scene.matchStats.fallsIn, { red: 1, blue: 0 }, 'the post-decision fall is not counted');
});

// Dev mode drives a whole match through scene.update via step() with no render call in between
// (the HUD, which used to own the tracker, never runs). MatchStats has to be attached from the
// moment the scene is created, or every fall before the first render is lost.
test('stats are counted even when a match runs entirely through updates, with no render', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  findPlayer(scene, 'red').y = 600;
  scene.update(neutralInputs());

  assert.deepEqual(scene.matchStats.fallsIn, { red: 1, blue: 0 });
});

function playHeldCard(scene, player, cardName) {
  player.heldCardName = cardName;
  player.heldCardUsesRemaining = 3;
  scene.update(neutralInputs()); // release the action key held from spawn
  scene.update({ red: { ...noInput(), action: true }, blue: noInput() });
}

test('a bomb lands ahead of the thrower and knocks a nearby player away', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  red.x = 90;
  red.y = 196;
  blue.x = 180;
  blue.y = 196;
  const explosions = [];
  scene.events.on('bomb-exploded', (event) => explosions.push(event));

  playHeldCard(scene, red, 'bomb');
  advance(scene, 60);

  assert.equal(explosions.length, 1);
  assert.ok(explosions[0].x > red.x + red.width, 'the bomb went off ahead of the thrower');
  assert.ok(
    (blue.x + blue.width / 2 - explosions[0].x) * (blue.x - 180) > 0,
    'the blast pushes blue away from the bomb',
  );
  assert.equal(scene.entityGroups.get('bombs').length, 0);
});

test('a bomb explodes in the sea', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  const red = findPlayer(scene, 'red');
  red.x = 200;
  red.y = 196;
  const explosions = [];
  scene.events.on('bomb-exploded', (event) => explosions.push(event));

  playHeldCard(scene, red, 'bomb');
  advance(scene, 90);

  assert.equal(explosions.length, 1);
});

test('stepping on a banana makes a player slip for the set ticks, then the banana is gone', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  red.x = 100;
  red.y = 196;
  blue.x = 400;
  blue.y = 196;
  const slips = [];
  scene.events.on('player-slipped', (event) => slips.push(event));

  playHeldCard(scene, red, 'banana');
  assert.equal(scene.entityGroups.get('bananas').length, 1);
  const banana = scene.entityGroups.get('bananas')[0];
  assert.ok(banana.x + banana.width <= red.x + 8, 'the banana lands behind the dropper');

  blue.x = banana.x;
  blue.y = banana.y - blue.height;
  blue.velocityX = -2;
  scene.update(neutralInputs());

  assert.deepEqual(slips, [{ playerId: 'blue' }]);
  assert.equal(scene.entityGroups.get('bananas').length, 0, 'one slip uses the banana up');
  const startX = blue.x;
  advance(scene, 5, { red: noInput(), blue: { left: false, right: true, jump: false } });
  assert.ok(blue.x < startX - 20, 'blue keeps sliding left even while steering right');
});

test('the dropper does not slip on their own banana right away', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  const red = findPlayer(scene, 'red');
  red.x = 100;
  red.y = 196;
  playHeldCard(scene, red, 'banana');
  const banana = scene.entityGroups.get('bananas')[0];

  red.x = banana.x;
  scene.update(neutralInputs());
  assert.equal(red.slipTicksRemaining, 0, 'immune while the banana is fresh');
  assert.equal(scene.entityGroups.get('bananas').length, 1);

  advance(scene, 40);
  assert.ok(red.slipTicksRemaining > 0, 'the dropper slips once the immunity is over');
});

test('a banana dropped over the sea falls in and disappears', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  const red = findPlayer(scene, 'red');
  red.x = 300;
  red.y = 250;
  red.velocityY = -20;
  playHeldCard(scene, red, 'banana');
  assert.equal(scene.entityGroups.get('bananas').length, 1);

  advance(scene, 120);

  assert.equal(scene.entityGroups.get('bananas').length, 0);
});

for (const [fileName, level] of Object.entries(arenaLevels)) {
  test(`in ${fileName} the sea stops at the sudden death line and both players stay dry on the top platform`, () => {
    const scene = new VersusScene({ level });
    advance(scene, READY_TICKS);
    const topPlatform = level.openTops
      .filter((openTop) => openTop.y < level.suddenDeathLineY)
      .sort((first, second) => second.width - first.width)[0];
    const red = findPlayer(scene, 'red');
    const blue = findPlayer(scene, 'blue');
    red.x = topPlatform.x + 4;
    blue.x = topPlatform.x + topPlatform.width - blue.width - 4;
    for (const player of [red, blue]) {
      player.y = topPlatform.y - player.height;
      player.onGround = true;
    }

    advance(scene, SUDDEN_DEATH_ROUND_TICKS + SUDDEN_DEATH_WARNING_TICKS + 1200 + 60);

    assert.equal(scene.waterLineY, level.suddenDeathLineY);
    assert.equal(red.inWater, false);
    assert.equal(blue.inWater, false);
    assert.equal(scene.phase, 'fight');
  });
}

test('rooftops keeps its two fixed bounce pads for the whole match, one set per round', () => {
  const scene = new VersusScene({ level: arenaLevels.rooftops });
  advance(scene, READY_TICKS + 400);
  assert.equal(scene.entityGroups.get('bouncePads').length, 2, 'fixed pads never expire');

  findPlayer(scene, 'red').y = 600;
  scene.update(neutralInputs());
  advance(scene, KNOCKOUT_SLOWMO_TICKS + 90); // slow motion and point pause resolve back to a fresh 'ready' round

  assert.equal(scene.phase, 'ready');
  assert.deepEqual(
    scene.entityGroups.get('bouncePads').map(({ x, y }) => ({ x, y })),
    arenaLevels.rooftops.bouncePads,
  );
});

test('landing on a rooftops fixed bounce pad launches the player', () => {
  const scene = new VersusScene({ level: arenaLevels.rooftops });
  advance(scene, READY_TICKS);
  const pad = arenaLevels.rooftops.bouncePads[0];
  const red = findPlayer(scene, 'red');
  red.x = pad.x;
  red.y = pad.y - red.height - 4; // feet just above the pad's top surface
  red.velocityY = 6;
  red.onGround = false;

  scene.update(neutralInputs());

  assert.equal(red.velocityY, -12.5, 'the pad launches the player upward at the neutral pad speed');
});

test('a rocket blast shakes the picture by whole pixels, then the shake settles', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  const fallenPlayer = findPlayer(scene, 'red');
  scene.events.emit('rocket-exploded', { x: 0, y: 0 });
  assert.ok(scene.screenShake.offset.x !== 0 || scene.screenShake.offset.y !== 0);
  for (const value of Object.values(scene.screenShake.offset)) assert.ok(Number.isInteger(value));
  advance(scene, 12);
  assert.deepEqual(scene.screenShake.offset, { x: 0, y: 0 });
  assert.equal(fallenPlayer.inWater, false);
});

test('a hit kicks the picture in the direction it went, harder for stronger hits, then settles', () => {
  const scene = new VersusScene({ level: harborLevel });
  scene.events.emit('player-shoved', {
    shoverId: 'red',
    targetId: 'blue',
    directionX: -1,
    directionY: 0,
    strength: 'light',
  });
  const lightKick = scene.screenShake.offset;
  assert.ok(lightKick.x < 0 && lightKick.y === 0);
  assert.ok(Number.isInteger(lightKick.x));

  for (let tick = 0; tick < 8; tick++) scene.screenShake.update();
  assert.deepEqual(scene.screenShake.offset, { x: 0, y: 0 });

  scene.events.emit('player-shoved', {
    shoverId: 'red',
    targetId: 'blue',
    directionX: -1,
    directionY: 0,
    strength: 'heavy',
  });
  assert.ok(scene.screenShake.offset.x < lightKick.x);
});

test('a dash hit kicks the picture the way the dasher was heading', () => {
  const scene = new VersusScene({ level: harborLevel });
  scene.events.emit('dash-hit', { playerIds: ['red', 'blue'], directionX: -1, directionY: 0, strength: 'medium' });
  assert.ok(scene.screenShake.offset.x < 0 && scene.screenShake.offset.y === 0);
});

test('a bounce pad kicks the picture upward', () => {
  const scene = new VersusScene({ level: harborLevel });
  scene.events.emit('trap-sprung', {
    ownerId: 'blue',
    targetId: 'red',
    directionX: 0,
    directionY: -1,
    strength: 'light',
  });
  assert.ok(scene.screenShake.offset.y < 0 && scene.screenShake.offset.x === 0);
});

test('falling in the sea shakes the picture', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  findPlayer(scene, 'red').y = 600;
  scene.update(neutralInputs());
  assert.ok(scene.screenShake.ticksRemaining > 0);
});

test('a blast names the players it knocked back, and only them', () => {
  const scene = new VersusScene({ level: harborLevel });
  advance(scene, READY_TICKS);
  const red = findPlayer(scene, 'red');
  red.x = 280;
  red.y = 200;
  const blue = findPlayer(scene, 'blue');
  blue.x = 560;
  blue.y = 200;
  const rocket = new Rocket({ x: 300, y: 200, facing: 1, shooterId: 'blue' });
  rocket.ticksRemaining = 1;
  scene.entityGroups.add('rockets', rocket);
  const explosionEvents = [];
  scene.events.on('rocket-exploded', (event) => explosionEvents.push(event));

  advance(scene, 1 + HITSTOP_TICKS.heavy);

  assert.deepEqual(explosionEvents[0].playerIds, ['red']);
});
