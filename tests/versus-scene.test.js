import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCREEN_WIDTH } from '../src/engine/config.js';
import { Crate } from '../src/entities/crate.js';
import { Platform } from '../src/entities/platform.js';
import { Rocket } from '../src/entities/rocket.js';
import { BouncePad } from '../src/entities/bounce-pad.js';
import { VersusScene } from '../src/scenes/versus-scene.js';

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

const READY_TICKS = 60;
const BUMP_KNOCKBACK_VELOCITY_X = 3;

test('falling in the sea scores the other player', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);
  assert.equal(scene.phase, 'fight');

  const waterEvents = [];
  scene.events.on('player-fell-in-water', (event) => waterEvents.push(event));

  findPlayer(scene, 'red').y = 600;
  scene.update(neutralInputs());

  assert.deepEqual(waterEvents, [{ playerId: 'red' }]);
  assert.equal(scene.phase, 'point');
  assert.equal(scene.winnerId, 'blue');
  assert.equal(scene.wins.blue, 1);
  assert.equal(scene.wins.red, 0);
});

test('reaching 5 points ends the match', () => {
  const scene = new VersusScene();

  for (let win = 1; win <= 5; win++) {
    advance(scene, READY_TICKS);
    findPlayer(scene, 'blue').y = 600;
    scene.update(neutralInputs());

    assert.equal(scene.wins.red, win);
    if (win < 5) {
      assert.equal(scene.phase, 'point');
      advance(scene, 90); // point pause resolves back to a fresh 'ready' round
    }
  }

  assert.equal(scene.phase, 'match');
});

test('both players falling on the same tick is a draw', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  findPlayer(scene, 'red').y = 600;
  findPlayer(scene, 'blue').y = 600;
  scene.update(neutralInputs());

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
    const scene = new VersusScene();
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

test('two players running into each other end up side by side, never overlapping', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  red.x = 264;
  red.y = 116;
  red.onGround = true;
  blue.x = 356;
  blue.y = 116;
  blue.onGround = true;

  for (let tick = 0; tick < 60; tick++) {
    scene.update({ red: { left: false, right: true, jump: false }, blue: { left: true, right: false, jump: false } });
  }

  assert.equal(red.overlaps(blue), false);
  assert.ok(red.x < blue.x, 'red stays on the left, blue stays on the right');
});

test('a player running into a standing player pushes them', () => {
  const scene = new VersusScene();
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

  for (let tick = 0; tick < 40; tick++) {
    scene.update({ red: { left: false, right: true, jump: false }, blue: noInput() });
  }

  assert.ok(blue.x > blueStartX, 'the standing player gets shoved away');
  assert.equal(red.overlaps(blue), false);
});

test('a player jumping over another is not pushed sideways', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  red.x = 264;
  red.y = 116;
  red.onGround = true;
  blue.x = 300;
  blue.y = 116;
  blue.onGround = true;
  const blueStartX = blue.x;

  const bumpEvents = [];
  scene.events.on('players-bumped', (event) => bumpEvents.push(event));

  scene.update({ red: noInput(), blue: noInput() }); // releases the jump key held from spawn before pressing it fresh

  for (let tick = 0; tick < 35; tick++) {
    scene.update({ red: { left: false, right: true, jump: tick < 15 }, blue: noInput() });
  }

  assert.equal(blue.x, blueStartX, 'jumping over does not shove the other player');
  assert.deepEqual(bumpEvents, []);
});

test('players-bumped fires once per contact, not every tick', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  red.x = 264;
  red.y = 116;
  red.onGround = true;
  blue.x = 356;
  blue.y = 116;
  blue.onGround = true;

  const bumpEvents = [];
  scene.events.on('players-bumped', (event) => bumpEvents.push(event));

  for (let tick = 0; tick < 60; tick++) {
    scene.update({ red: { left: false, right: true, jump: false }, blue: { left: true, right: false, jump: false } });
  }

  assert.equal(bumpEvents.length, 1);
  assert.deepEqual(bumpEvents[0], { playerIds: ['red', 'blue'] });
});

test('two players held into each other settle at a gap of zero, not a buzz', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  red.x = 264;
  red.y = 116;
  red.onGround = true;
  blue.x = 356;
  blue.y = 116;
  blue.onGround = true;

  const inputs = { red: { left: false, right: true, jump: false }, blue: { left: true, right: false, jump: false } };
  let contactStarted = false;
  for (let tick = 0; tick < 120; tick++) {
    scene.update(inputs);
    const gap = blue.x - (red.x + red.width);
    if (!contactStarted) {
      if (gap === 0) contactStarted = true;
      continue;
    }
    assert.equal(gap, 0, `gap should stay at 0 once contact starts, tick ${tick}`);
  }

  assert.ok(contactStarted, 'the players should have made contact');
});

test('a stomp bounces the stomper up and knocks the other player sideways, away from the stomper', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  blue.x = 300;
  blue.y = 116;
  blue.onGround = true;
  red.x = 292; // left of blue's center, so a stomp should knock blue further right
  red.y = 82;
  red.velocityY = 4;
  red.onGround = false;
  red.airJumpAvailable = false; // used up already, so a refresh from the stomp is observable

  const stompEvents = [];
  scene.events.on('player-stomped', (event) => stompEvents.push(event));

  for (let tick = 0; tick < 5; tick++) {
    scene.update({ red: { left: false, right: false, jump: true }, blue: noInput() });
  }

  assert.deepEqual(stompEvents, [{ stomperId: 'red', stompedId: 'blue' }]);
  assert.ok(red.velocityY < 0, 'the stomper bounces upward');
  assert.equal(red.airJumpAvailable, true, 'a successful stomp refreshes the air jump');
  assert.ok(blue.knockbackVelocityX > 0, 'the stomped player is knocked away from the stomper');
  assert.ok(blue.dizzyTicksRemaining > 0, 'the stomped player is dizzy');
});

test('holding jump during a stomp bounces higher than not holding it', () => {
  function stompAndBounce(jumpHeldDuringStomp) {
    const scene = new VersusScene();
    advance(scene, READY_TICKS);

    const red = findPlayer(scene, 'red');
    const blue = findPlayer(scene, 'blue');
    blue.x = 300;
    blue.y = 116;
    blue.onGround = true;
    red.x = 300;
    red.y = 82;
    red.velocityY = 4;
    red.onGround = false;
    scene.update({ red: noInput(), blue: noInput() }); // release the jump key held from spawn

    for (let tick = 0; tick < 5; tick++) {
      scene.update({ red: { left: false, right: false, jump: jumpHeldDuringStomp }, blue: noInput() });
      if (red.velocityY < 0) return red.velocityY;
    }
    throw new Error('the stomp never bounced the stomper');
  }

  const bounceHoldingJump = stompAndBounce(true);
  const bounceWithoutJump = stompAndBounce(false);

  assert.ok(
    bounceHoldingJump < bounceWithoutJump,
    'holding jump should launch the stomper higher (a more negative velocity)',
  );
});

test('a fast fall still lands a stomp at every drop height from 60 to 200 px', () => {
  for (let dropHeight = 60; dropHeight <= 200; dropHeight += 2) {
    const scene = new VersusScene();
    advance(scene, READY_TICKS);

    const red = findPlayer(scene, 'red');
    const blue = findPlayer(scene, 'blue');
    blue.x = 300;
    blue.y = 116;
    blue.onGround = true;
    red.x = 300;
    red.y = blue.y - dropHeight;
    red.previousY = red.y;
    red.velocityY = 12; // already at max fall speed, the fastest a player can fall
    red.onGround = false;

    const stompEvents = [];
    scene.events.on('player-stomped', (event) => stompEvents.push(event));

    const ticksToLand = Math.ceil(dropHeight / 12) + 3;
    for (let tick = 0; tick < ticksToLand; tick++) {
      scene.update({ red: noInput(), blue: noInput() });
    }

    assert.equal(stompEvents.length, 1, `drop height ${dropHeight}px should land exactly one stomp`);
  }
});

test('a player moving past the right edge reappears on the left with the same velocity', () => {
  const scene = new VersusScene();
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
  const scene = new VersusScene();
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
  const scene = new VersusScene();
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

test('the sea rises only after the warning ends, and a player standing below it loses the round', () => {
  const scene = new VersusScene();
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

  assert.equal(blue.inWater, true, 'the risen sea reaches the side platform');
  assert.equal(red.inWater, false, 'the middle platform is still above the sea');
  assert.equal(scene.phase, 'point');
  assert.equal(scene.winnerId, 'red');
});

test('the timer and the sea reset for the next round', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);
  advance(scene, SUDDEN_DEATH_ROUND_TICKS);
  assert.equal(scene.suddenDeathPhase, 'warning');

  findPlayer(scene, 'red').y = 600;
  scene.update(neutralInputs());
  assert.equal(scene.phase, 'point');

  advance(scene, 90); // point pause resolves back to a fresh 'ready' round
  assert.equal(scene.phase, 'ready');
  assert.equal(scene.suddenDeathPhase, 'none');
  assert.equal(scene.fightTicks, 0);
  assert.equal(scene.waterLineY, 328);
});

test('a dash into the opponent knocks them away', () => {
  const scene = new VersusScene();
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

  const bumpEvents = [];
  scene.events.on('players-bumped', (event) => bumpEvents.push(event));

  for (let tick = 0; tick < 10 && bumpEvents.length === 0; tick++) {
    scene.update({ red: noInput(), blue: noInput() });
  }

  assert.equal(bumpEvents.length, 1, 'the dash carries red into blue');
  assert.ok(blue.knockbackVelocityX > BUMP_KNOCKBACK_VELOCITY_X, 'a dash hit knocks harder than an ordinary bump');

  for (let tick = 0; tick < 15; tick++) {
    scene.update({ red: noInput(), blue: noInput() });
  }

  assert.ok(blue.x > blueStartX, 'the dashed-into player is knocked away');
  assert.equal(red.overlaps(blue), false);
});

test('a dash into an opponent already being pushed against still lands the dash hit', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  red.x = 264;
  red.y = 116;
  red.onGround = true;
  red.facing = 1;
  blue.x = 289; // one pixel of gap, so the push closes it within the first tick
  blue.y = 116;
  blue.onGround = true;

  const pushInputs = {
    red: { left: false, right: true, jump: false },
    blue: { left: true, right: false, jump: false },
  };
  for (let tick = 0; tick < 10; tick++) {
    scene.update(pushInputs);
  }

  assert.equal(blue.x - (red.x + red.width), 0, 'red is already pushed up against blue before dashing');

  red.heldCardName = 'dash';
  const bumpEvents = [];
  scene.events.on('players-bumped', (event) => bumpEvents.push(event));

  scene.update({ red: noInput(), blue: noInput() }); // release the jump/action keys held from the push
  scene.update({ red: { left: false, right: false, jump: false, action: true }, blue: noInput() });

  assert.equal(bumpEvents.length, 1, 'the dash lands a hit immediately, even though the players were already touching');
  assert.ok(
    blue.knockbackVelocityX > BUMP_KNOCKBACK_VELOCITY_X,
    'a dash into a touching opponent knocks as hard as a dash from range',
  );

  for (let tick = 0; tick < 15; tick++) {
    scene.update({ red: noInput(), blue: noInput() });
  }

  assert.ok(blue.x - (red.x + red.width) > 0, 'blue ends clearly separated from red');
});

test('a shove knocks the player in front away and pops them upward', () => {
  const scene = new VersusScene();
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

  assert.deepEqual(shoveEvents, [{ shoverId: 'red', targetId: 'blue' }]);
  assert.ok(blue.knockbackVelocityX > 0, 'the shove knocks blue away from red');
  assert.ok(blue.velocityY < 0, 'the shove pops blue upward');

  for (let tick = 0; tick < 15; tick++) {
    scene.update({ red: noInput(), blue: noInput() });
  }

  assert.ok(blue.x > blueStartX, 'the shoved player ends up pushed away');
});

test('a shove never hits a player standing behind the shover', () => {
  const scene = new VersusScene();
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
  const scene = new VersusScene();
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
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  red.heldCardName = 'dash';
  scene.update({ red: noInput(), blue: noInput() }); // release the action key held from spawn

  const cardEvents = [];
  scene.events.on('card-played', (event) => cardEvents.push(event));

  red.y = 600; // below the water line, falls in on this tick
  scene.update({ red: { left: false, right: false, jump: false, action: true }, blue: noInput() });
  assert.equal(scene.phase, 'point');
  assert.equal(red.inWater, true);

  advance(scene, 60); // keep sinking well past the point pause

  assert.equal(cardEvents.length, 1, 'the press should fire card-played exactly once');
});

test('startInFightPhase skips the Ready countdown for the first round only', () => {
  const scene = new VersusScene({ startInFightPhase: true });
  assert.equal(scene.phase, 'fight');

  findPlayer(scene, 'red').y = 600;
  scene.update(neutralInputs());
  assert.equal(scene.phase, 'point');

  advance(scene, 90); // point pause resolves into the next round
  assert.equal(scene.phase, 'ready');
});

test('a rocket blast pushes a player away from the blast center and emits rocket-exploded', () => {
  const scene = new VersusScene();
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

  scene.update(neutralInputs());

  assert.ok(red.knockbackVelocityX < 0, 'the player left of the blast is pushed further left');
  assert.ok(blue.knockbackVelocityX > 0, 'the player right of the blast is pushed further right');
  assert.equal(explosionEvents.length, 1);
  assert.equal(explosionEvents[0].x, rocket.x + rocket.width / 2);
  assert.equal(explosionEvents[0].y, rocket.y + rocket.height / 2);
  assert.equal(scene.entityGroups.get('rockets').length, 0, 'the exploded rocket is removed');
});

test('a rocket wraps around the screen edges like a player', () => {
  const scene = new VersusScene();
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
  const jumpScene = new VersusScene();
  advance(jumpScene, READY_TICKS);
  jumpScene.update(neutralInputs()); // release the jump key held from spawn
  // Held the whole way up, so the jump reaches its full, uncut height.
  const jumpRise = riseToApex(jumpScene, 'red', {
    red: { left: false, right: false, jump: true, action: false },
    blue: noInput(),
  });
  assert.ok(jumpRise > 0, 'a held jump rises above its starting height');

  const scene = new VersusScene();
  advance(scene, READY_TICKS);
  // A gap with no platform above or below it, so nothing but gravity shapes either player's arc.
  scene.entityGroups.add('bouncePads', new BouncePad({ x: 236, y: 280 }));

  const red = findPlayer(scene, 'red');
  red.x = 240;
  red.y = 248; // feet above the pad's top surface
  red.velocityY = 12; // already falling at max speed, so this tick's fall crosses the pad
  red.onGround = false;
  scene.update(neutralInputs()); // the fall crosses the pad and launches red this tick
  assert.ok(red.velocityY < 0, 'the pad launches the player upward');

  const padRise = riseToApex(scene, 'red', neutralInputs());

  assert.ok(padRise > jumpRise, 'the pad launches the player higher than a full held jump');
});

test('walking into the side of a bounce pad does nothing', () => {
  const scene = new VersusScene();
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
  const scene = new VersusScene();
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

test('a player standing where a bounce pad appears is launched at once', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  blue.heldCardName = 'bouncePad';
  scene.update(neutralInputs()); // release the action key held from spawn

  // Placed on the same tick the card is played, so the two players are not already pushed
  // apart by the bump resolution a lasting overlap between them would otherwise trigger.
  blue.x = 300;
  blue.y = 116; // standing on the middle platform
  blue.onGround = true;
  red.x = blue.x;
  red.y = blue.y;
  red.onGround = true;
  red.velocityY = 0;

  scene.update({ red: noInput(), blue: { left: false, right: false, jump: false, action: true } });

  assert.ok(red.velocityY < 0, 'a player already standing on the spot is launched immediately');
});

test('a bounce pad disappears after 300 ticks', () => {
  const scene = new VersusScene();
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
  const scene = new VersusScene();
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
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  red.x = 200;
  red.y = 200;
  addLandedCrate(scene, { x: red.x, y: red.y, cardName: 'rocket' });

  scene.update(neutralInputs());

  assert.equal(red.heldCardName, 'rocket');
  assert.equal(red.heldCardUsesRemaining, 3);
});

test('crates only ever hold dash, rocket or a bounce pad', () => {
  const allowedCardNames = new Set(['dash', 'rocket', 'bouncePad']);
  for (let seed = 1; seed <= 20; seed++) {
    const scene = new VersusScene({ seed });
    for (let tick = 0; tick < 600; tick++) {
      scene.update(neutralInputs());
      for (const crate of scene.entityGroups.get('crates')) {
        assert.ok(allowedCardNames.has(crate.cardName), `seed ${seed} dropped ${crate.cardName}`);
      }
    }
  }
});

test('a player already holding a card cannot open a crate, and the crate stays', () => {
  const scene = new VersusScene();
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
  const scene = new VersusScene({ seed: 1 });
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
    const scene = new VersusScene({ seed });
    advance(scene, READY_TICKS);
    advance(scene, 130); // past the 120 tick spawn delay, before the crate has landed
    const crate = scene.entityGroups.get('crates')[0];
    return { x: crate.x, y: crate.y, cardName: crate.cardName };
  }

  assert.deepEqual(firstCrateAfterSpawn(7), firstCrateAfterSpawn(7));
});

test('while the sea is above the side platforms, every crate lands on the still-dry middle platform', () => {
  for (let seed = 0; seed < 20; seed++) {
    const scene = new VersusScene({ seed });
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
  const scene = new VersusScene();
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
  const scene = new VersusScene();
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
  const scene = new VersusScene();
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
  const scene = new VersusScene();
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

const RESTART_DELAY_TICKS = 60;

function reachMatchPhase(scene) {
  for (let win = 1; win <= 5; win++) {
    advance(scene, READY_TICKS);
    findPlayer(scene, 'blue').y = 600;
    scene.update(neutralInputs());
    if (win < 5) advance(scene, 90); // point pause resolves back to a fresh 'ready' round
  }
}

test('a fall landed after the round is already decided is not counted in match stats', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');

  red.y = 600; // red falls in during the fight, deciding the round
  scene.update(neutralInputs());
  assert.equal(scene.phase, 'point');
  assert.deepEqual(scene.matchStats.fallsIn, { red: 1, blue: 0 });

  // A late rocket (or leftover momentum) knocks the winner in after the round is already over.
  blue.y = 600;
  scene.update(neutralInputs());
  assert.equal(blue.inWater, true, 'blue still falls in; the event still fires');
  assert.deepEqual(scene.matchStats.fallsIn, { red: 1, blue: 0 }, 'the post-decision fall is not counted');
});

// Dev mode drives a whole match through scene.update via step() with no render call in between
// (the HUD, which used to own the tracker, never runs). MatchStats has to be attached from the
// moment the scene is created, or every stomp and fall before the first render is lost.
test('stats are counted even when a match runs entirely through updates, with no render', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  blue.x = 300;
  blue.y = 116;
  blue.onGround = true;
  red.x = 300;
  red.y = 60;
  red.previousY = red.y;
  red.velocityY = 12;
  red.onGround = false;

  const stompEvents = [];
  scene.events.on('player-stomped', (event) => stompEvents.push(event));
  advance(scene, 10);
  assert.equal(stompEvents.length, 1, 'the stomp should have landed');

  findPlayer(scene, 'red').y = 600;
  scene.update(neutralInputs());

  assert.deepEqual(scene.matchStats.stomps, { red: 1, blue: 0 });
  assert.deepEqual(scene.matchStats.fallsIn, { red: 1, blue: 0 });
});

test('a new match starts only once every player is ready', () => {
  const scene = new VersusScene();
  reachMatchPhase(scene);
  assert.equal(scene.phase, 'match');

  // The results screen is not showing yet; a jump here (still held from the fight) never counts.
  for (let tick = 0; tick < RESTART_DELAY_TICKS; tick++) {
    scene.update({ red: { left: false, right: false, jump: true }, blue: { left: false, right: false, jump: true } });
  }
  assert.equal(scene.phase, 'match');

  // The results screen is showing now, but both players are still holding jump from before it
  // appeared. A press held over like this must not count.
  scene.update({ red: { left: false, right: false, jump: true }, blue: { left: false, right: false, jump: true } });
  assert.equal(scene.phase, 'match', 'a press held over from before the results screen does not ready anyone up');
  assert.equal(scene.matchReadyIds.size, 0);

  // Red releases and presses again: a fresh press, so only red is ready.
  scene.update(neutralInputs());
  scene.update({ red: { left: false, right: false, jump: true }, blue: noInput() });
  assert.equal(scene.matchReadyIds.has('red'), true);
  assert.equal(scene.matchReadyIds.has('blue'), false);
  assert.equal(scene.phase, 'match', 'the match does not restart until every player is ready');

  // Blue releases and presses too: now both are ready.
  scene.update(neutralInputs());
  scene.update({ red: noInput(), blue: { left: false, right: false, jump: true } });

  assert.equal(scene.phase, 'ready', 'the new match starts once every player is ready');
  assert.equal(scene.wins.red, 0);
  assert.equal(scene.wins.blue, 0);
});
