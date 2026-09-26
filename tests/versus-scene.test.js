import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCREEN_WIDTH } from '../src/engine/config.js';
import { Crate } from '../src/entities/crate.js';
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
const BUMP_KNOCKBACK_VELOCITY_X = 1.5;

test('falling in the sea scores the other player', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);
  assert.equal(scene.phase, 'fight');

  const waterEvents = [];
  scene.events.on('player-fell-in-water', (event) => waterEvents.push(event));

  findPlayer(scene, 'red').y = 300;
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
    findPlayer(scene, 'blue').y = 300;
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

  findPlayer(scene, 'red').y = 300;
  findPlayer(scene, 'blue').y = 300;
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
  red.x = 132;
  red.y = 60;
  red.onGround = true;
  blue.x = 178;
  blue.y = 60;
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
  red.x = 132;
  red.y = 60;
  red.onGround = true;
  blue.x = 170;
  blue.y = 60;
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
  red.x = 132;
  red.y = 60;
  red.onGround = true;
  blue.x = 150;
  blue.y = 60;
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
  red.x = 132;
  red.y = 60;
  red.onGround = true;
  blue.x = 178;
  blue.y = 60;
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
  red.x = 132;
  red.y = 60;
  red.onGround = true;
  blue.x = 178;
  blue.y = 60;
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
  blue.x = 150;
  blue.y = 60;
  blue.onGround = true;
  red.x = 146; // left of blue's center, so a stomp should knock blue further right
  red.y = 45;
  red.velocityY = 2;
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
    blue.x = 150;
    blue.y = 60;
    blue.onGround = true;
    red.x = 150;
    red.y = 45;
    red.velocityY = 2;
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

test('a fast fall still lands a stomp at every drop height from 30 to 100 px', () => {
  for (let dropHeight = 30; dropHeight <= 100; dropHeight++) {
    const scene = new VersusScene();
    advance(scene, READY_TICKS);

    const red = findPlayer(scene, 'red');
    const blue = findPlayer(scene, 'blue');
    blue.x = 150;
    blue.y = 60;
    blue.onGround = true;
    red.x = 150;
    red.y = blue.y - dropHeight;
    red.previousY = red.y;
    red.velocityY = 6; // already at max fall speed, the fastest a player can fall
    red.onGround = false;

    const stompEvents = [];
    scene.events.on('player-stomped', (event) => stompEvents.push(event));

    const ticksToLand = Math.ceil(dropHeight / 6) + 3;
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
  red.x = SCREEN_WIDTH - 30;
  red.y = 60;
  blue.x = 150; // out of the way, on screen
  blue.y = 60; // standing on the middle platform, not mid-air where it would fall in and end the round
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
    red.y = 60;
  }

  assert.equal(wrapEvents.length, 1);
  assert.equal(wrapEvents[0].playerId, 'red');
  assert.equal(wrapEvents[0].x, red.x);
  assert.ok(red.x >= 0 && red.x < 10, 'red reappears near the left edge');
  assert.ok(Math.abs(wrapEvents[0].y - 60) < 1, 'height is unaffected by the wrap');
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
  assert.equal(red.y, 60); // standing on the middle platform (y 72, player height 12)
  assert.ok(red.x + red.width > 128 && red.x < 192, 'red should be within the middle platform bounds');
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

  // Fast-forward the sea between the two platform heights (side platforms bottom at 112, middle at 72):
  // red on the middle platform should stay dry while blue on a side platform is swallowed.
  scene.waterLineY = 90;
  const red = findPlayer(scene, 'red');
  red.x = 132;
  red.y = 60; // standing on the middle platform, top y 72
  red.onGround = true;
  const blue = findPlayer(scene, 'blue');
  blue.x = 60;
  blue.y = 100; // standing on the side platform, top y 112
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

  findPlayer(scene, 'red').y = 300;
  scene.update(neutralInputs());
  assert.equal(scene.phase, 'point');

  advance(scene, 90); // point pause resolves back to a fresh 'ready' round
  assert.equal(scene.phase, 'ready');
  assert.equal(scene.suddenDeathPhase, 'none');
  assert.equal(scene.fightTicks, 0);
  assert.equal(scene.waterLineY, 164);
});

test('a dash into the opponent knocks them away', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  red.x = 132;
  red.y = 60;
  red.onGround = true;
  red.facing = 1;
  blue.x = 150;
  blue.y = 60;
  blue.onGround = true;
  const blueStartX = blue.x;
  red.heldCardName = 'dash';

  const cardEvents = [];
  scene.events.on('card-played', (event) => cardEvents.push(event));

  // Release the jump/card keys held from spawn before pressing fresh, then dash.
  scene.update({ red: noInput(), blue: noInput() });
  scene.update({ red: { left: false, right: false, jump: false, card: true }, blue: noInput() });

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

test('a card pressed on the tick a player falls in the sea emits card-played once, not every sinking tick', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  red.heldCardName = 'dash';
  scene.update({ red: noInput(), blue: noInput() }); // release the card key held from spawn

  const cardEvents = [];
  scene.events.on('card-played', (event) => cardEvents.push(event));

  red.y = 300; // below the water line, falls in on this tick
  scene.update({ red: { left: false, right: false, jump: false, card: true }, blue: noInput() });
  assert.equal(scene.phase, 'point');
  assert.equal(red.inWater, true);

  advance(scene, 60); // keep sinking well past the point pause

  assert.equal(cardEvents.length, 1, 'the press should fire card-played exactly once');
});

test('startInFightPhase skips the Ready countdown for the first round only', () => {
  const scene = new VersusScene({ startInFightPhase: true });
  assert.equal(scene.phase, 'fight');

  findPlayer(scene, 'red').y = 300;
  scene.update(neutralInputs());
  assert.equal(scene.phase, 'point');

  advance(scene, 90); // point pause resolves into the next round
  assert.equal(scene.phase, 'ready');
});

test('a rocket blast pushes a player away from the blast center and emits rocket-exploded', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red'); // placed left of the blast center
  red.x = 140;
  red.y = 100;
  const blue = findPlayer(scene, 'blue'); // placed right of the blast center
  blue.x = 160;
  blue.y = 100;

  const rocket = new Rocket({ x: 150, y: 100, facing: 1, shooterId: 'blue' });
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

  const rocket = new Rocket({ x: SCREEN_WIDTH + 1, y: 100, facing: 1, shooterId: 'red' });
  scene.entityGroups.add('rockets', rocket);

  scene.update(neutralInputs());

  assert.ok(rocket.x < SCREEN_WIDTH, 'the rocket reappears from the left edge once it has fully crossed the right one');
});

test('landing on a bounce pad launches the player higher than a jump', () => {
  const jumpScene = new VersusScene();
  advance(jumpScene, READY_TICKS);
  const jumper = findPlayer(jumpScene, 'red');
  jumpScene.update({ red: noInput(), blue: noInput() }); // release the jump key held from spawn
  jumpScene.update({ red: { left: false, right: false, jump: true, card: false }, blue: noInput() });
  const jumpVelocityY = jumper.velocityY;
  assert.ok(jumpVelocityY < 0, 'a jump gives upward velocity');

  const scene = new VersusScene();
  advance(scene, READY_TICKS);
  // Placed clear of any real platform, over the open air below the middle platform.
  scene.entityGroups.add('bouncePads', new BouncePad({ x: 150, y: 140 }));

  const red = findPlayer(scene, 'red');
  red.x = 152;
  red.y = 124; // feet above the pad's top surface
  red.velocityY = 6; // already falling at max speed, so this tick's fall crosses the pad
  red.onGround = false;

  scene.update(neutralInputs());

  assert.ok(red.velocityY < jumpVelocityY, 'the pad launches the player higher than a full jump');
});

test('walking into the side of a bounce pad does nothing', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);
  // Sitting on top of the middle platform, at the same feet level a standing player already has.
  scene.entityGroups.add('bouncePads', new BouncePad({ x: 150, y: 69 }));

  const red = findPlayer(scene, 'red');
  red.x = 130; // on the middle platform, approaching the pad from the side
  red.y = 60;
  red.velocityY = 0;
  red.onGround = true;

  for (let tick = 0; tick < 20; tick++) {
    scene.update({ red: { left: false, right: true, jump: false, card: false }, blue: noInput() });
  }

  assert.equal(red.velocityY, 0, 'walking past the pad from the side never launches the player');
});

test('a player standing where a bounce pad appears is launched at once', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  const blue = findPlayer(scene, 'blue');
  blue.heldCardName = 'bouncePad';
  scene.update(neutralInputs()); // release the card key held from spawn

  // Placed on the same tick the card is played, so the two players are not already pushed
  // apart by the bump resolution a lasting overlap between them would otherwise trigger.
  blue.x = 150;
  blue.y = 60; // standing on the middle platform
  blue.onGround = true;
  red.x = blue.x;
  red.y = blue.y;
  red.onGround = true;
  red.velocityY = 0;

  scene.update({ red: noInput(), blue: { left: false, right: false, jump: false, card: true } });

  assert.ok(red.velocityY < 0, 'a player already standing on the spot is launched immediately');
});

test('a bounce pad disappears after 300 ticks', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  red.heldCardName = 'bouncePad';
  scene.update({ red: noInput(), blue: noInput() }); // release the card key held from spawn
  scene.update({ red: { left: false, right: false, jump: false, card: true }, blue: noInput() }); // 1st tick since it appeared

  assert.equal(scene.entityGroups.get('bouncePads').length, 1);

  advance(scene, 298); // 299 ticks since it appeared

  assert.equal(scene.entityGroups.get('bouncePads').length, 1, 'still there just before 300 ticks');

  scene.update(neutralInputs()); // 300th tick since it appeared

  assert.equal(scene.entityGroups.get('bouncePads').length, 0, 'gone once 300 ticks have passed');
});

function addLandedCrate(scene, { x, y, cardName }) {
  const crate = new Crate({ x, y, cardName });
  crate.landed = true;
  scene.entityGroups.clear('crates');
  scene.entityGroups.add('crates', crate);
  return crate;
}

test('touching a crate with no card takes the card', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  red.x = 100;
  red.y = 100;
  const crate = addLandedCrate(scene, { x: red.x, y: red.y, cardName: 'dash' });

  const pickupEvents = [];
  scene.events.on('card-picked-up', (event) => pickupEvents.push(event));

  scene.update(neutralInputs());

  assert.deepEqual(pickupEvents, [{ playerId: 'red', cardName: 'dash' }]);
  assert.equal(red.heldCardName, 'dash');
  assert.equal(scene.entityGroups.get('crates').includes(crate), false, 'the taken crate is removed');
});

test('a player already holding a card cannot open a crate, and the crate stays', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);

  const red = findPlayer(scene, 'red');
  red.heldCardName = 'rocket';
  red.x = 100;
  red.y = 100;
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
  red.x = 132;
  red.y = 60; // standing on the middle platform, so it never falls in the sea while this runs
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
    scene.waterLineY = 90; // above the side platforms (top y 112), below the middle platform (top y 72)
    scene.entityGroups.clear('crates');
    scene.spawnCrate();

    const crate = scene.entityGroups.get('crates')[0];
    assert.ok(crate, 'a crate spawns since the middle platform is still dry');
    assert.ok(crate.x >= 128 && crate.x + crate.width <= 192, 'the crate lands on the middle platform only');
  }
});

test('a crate is removed once the rising sea reaches its platform', () => {
  const scene = new VersusScene();
  advance(scene, READY_TICKS);
  const crate = addLandedCrate(scene, { x: 60, y: 104, cardName: 'dash' }); // side platform, top y 112

  scene.waterLineY = 164;
  scene.update(neutralInputs());
  assert.equal(scene.entityGroups.get('crates')[0], crate, 'the crate stays while its platform is dry');

  scene.waterLineY = 105; // risen past the crate's platform
  scene.update(neutralInputs());
  assert.equal(scene.entityGroups.get('crates').includes(crate), false, 'the submerged crate is removed');
});
