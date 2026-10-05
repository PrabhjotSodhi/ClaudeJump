import { MAGNET_PULL_SPEED, MAGNET_STOP_DISTANCE } from '../engine/config.js';
import { BLAST_STRENGTH, blastIsReady } from '../engine/blast.js';
import { wrapAroundScreen } from '../engine/wrap-around-screen.js';
import {
  Banana,
  BANANA_HEIGHT,
  BANANA_SLIP_TICKS,
  BANANA_THROW_SPEED_X,
  BANANA_THROW_SPEED_Y,
  BANANA_WIDTH,
} from '../entities/banana.js';
import { BananaDrop } from '../entities/banana-drop.js';
import { Bomb, BOMB_WIDTH, BOMB_HEIGHT } from '../entities/bomb.js';
import {
  BouncePad,
  BOUNCE_PAD_WIDTH,
  BOUNCE_PAD_HEIGHT,
  BOUNCE_PAD_LAUNCH_VELOCITY,
  BOUNCE_PAD_FLING_VELOCITY_X,
  BOUNCE_PAD_FLING_VELOCITY_Y,
} from '../entities/bounce-pad.js';
import { IceShot, ICE_SHOT_WIDTH, ICE_SHOT_HEIGHT } from '../entities/ice-shot.js';
import { Rocket, ROCKET_WIDTH, ROCKET_HEIGHT } from '../entities/rocket.js';

function rectanglesOverlap(first, second) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

export function spawnRocket(scene, player) {
  const spawnX = player.facing > 0 ? player.x + player.width : player.x - ROCKET_WIDTH;
  const spawnY = player.y + player.height / 2 - ROCKET_HEIGHT / 2;
  scene.entityGroups.add('rockets', new Rocket({ x: spawnX, y: spawnY, facing: player.facing, shooterId: player.id }));
}

export function spawnBomb(scene, player) {
  const spawnX = player.facing > 0 ? player.x + player.width : player.x - BOMB_WIDTH;
  const spawnY = player.y + player.height / 2 - BOMB_HEIGHT / 2;
  scene.entityGroups.add('bombs', new Bomb({ x: spawnX, y: spawnY, facing: player.facing, throwerId: player.id }));
}

export function spawnIceShot(scene, player) {
  const x = player.facing > 0 ? player.x + player.width : player.x - ICE_SHOT_WIDTH;
  const y = player.y + player.height / 2 - ICE_SHOT_HEIGHT / 2;
  scene.entityGroups.add('iceShots', new IceShot({ x, y, facing: player.facing, shooterId: player.id }));
}

export function startMagnet(scene, player) {
  const targetIds = scene.players.filter((other) => other !== player && !other.inWater).map((other) => other.id);
  scene.events.emit('magnet-pulled', { playerId: player.id, targetIds });
}

// Tossed backward from just behind the player in a short arc, landing on the ground behind them or in the sea.
export function spawnBanana(scene, player) {
  const x = player.facing > 0 ? player.x - BANANA_WIDTH : player.x + player.width;
  const y = player.y + player.height - BANANA_HEIGHT;
  scene.entityGroups.add(
    'bananas',
    new Banana({
      x,
      y,
      dropperId: player.id,
      velocityX: -player.facing * BANANA_THROW_SPEED_X,
      velocityY: BANANA_THROW_SPEED_Y,
    }),
  );
}

// Placed under the player's feet wherever they are, even in midair over the sea. It only ever
// affects the other players.
export function spawnBouncePad(scene, player) {
  const x = player.x + player.width / 2 - BOUNCE_PAD_WIDTH / 2;
  const y = player.y + player.height - BOUNCE_PAD_HEIGHT;
  scene.entityGroups.add('bouncePads', new BouncePad({ x, y, ownerId: player.id }));
}

// The items already in flight, which keep moving after a round ends.
export function updateFlyingCardItems(scene) {
  updateRockets(scene);
  updateBombs(scene);
  updateIceShots(scene);
}

export function updateCardItems(scene) {
  updateFlyingCardItems(scene);
  updateMagnets(scene);
  updateBouncePads(scene);
  updateBananaRain(scene);
  updateBananas(scene);
}

function updateRockets(scene) {
  const platforms = scene.entityGroups.get('platforms');
  for (const rocket of scene.entityGroups.get('rockets')) {
    rocket.update(scene.players, platforms);
    wrapAroundScreen(rocket);
    if (!rocket.exploded) {
      scene.popCrateParachute((bounds) => rectanglesOverlap(bounds, rocket), Math.sign(rocket.velocityX), 'rocket');
    }
    if (rocket.exploded && blastIsReady(rocket, scene.players, rocket.shooterId)) resolveRocketExplosion(scene, rocket);
  }
}

function resolveRocketExplosion(scene, rocket) {
  const blastCenterX = rocket.x + rocket.width / 2;
  const blastCenterY = rocket.y + rocket.height / 2;
  const playerIds = scene.resolveBlast(blastCenterX, blastCenterY);
  for (const playerId of playerIds) if (playerId !== rocket.shooterId) scene.recordCause(playerId, 'rocket');
  scene.events.emit('rocket-exploded', { x: blastCenterX, y: blastCenterY, playerIds, strength: BLAST_STRENGTH });
  scene.entityGroups.remove('rockets', rocket);
}

function updateBombs(scene) {
  const platforms = scene.entityGroups.get('platforms');
  for (const bomb of scene.entityGroups.get('bombs')) {
    bomb.update(scene.players, platforms, scene.waterLineY);
    wrapAroundScreen(bomb);
    if (!bomb.exploded) {
      scene.popCrateParachute((bounds) => rectanglesOverlap(bounds, bomb), Math.sign(bomb.velocityX), 'bomb');
    }
    if (!bomb.exploded || !blastIsReady(bomb, scene.players, bomb.throwerId)) continue;

    const blastCenterX = bomb.x + bomb.width / 2;
    const blastCenterY = bomb.y + bomb.height / 2;
    const playerIds = scene.resolveBlast(blastCenterX, blastCenterY);
    scene.events.emit('bomb-exploded', { x: blastCenterX, y: blastCenterY, playerIds, strength: BLAST_STRENGTH });
    scene.entityGroups.remove('bombs', bomb);
  }
}

function updateIceShots(scene) {
  const platforms = scene.entityGroups.get('platforms');
  for (const iceShot of scene.entityGroups.get('iceShots')) {
    iceShot.update(scene.players, platforms);
    wrapAroundScreen(iceShot);
    if (!iceShot.finished) continue;

    const target = scene.players.find((player) => player.id === iceShot.hitPlayerId);
    const x = iceShot.x + iceShot.width / 2;
    const y = iceShot.y + iceShot.height / 2;
    if (target) {
      target.freezeSolid();
      scene.events.emit('player-iced', { shooterId: iceShot.shooterId, targetId: target.id, x, y });
    } else {
      scene.events.emit('ice-shattered', { x, y });
    }
    scene.entityGroups.remove('iceShots', iceShot);
  }
}

// Pulls sideways only, straight across the screen, and never slower than a pull already carrying the player.
function updateMagnets(scene) {
  for (const puller of scene.players) {
    if (puller.magnetTicksRemaining <= 0) continue;
    puller.magnetTicksRemaining = puller.inWater ? 0 : puller.magnetTicksRemaining - 1;
    for (const target of scene.players) {
      if (target === puller || target.inWater) continue;
      const distanceX = puller.x - target.x;
      if (Math.abs(distanceX) <= MAGNET_STOP_DISTANCE) continue;
      const direction = Math.sign(distanceX);
      if (target.knockbackVelocityX * direction < MAGNET_PULL_SPEED) {
        target.knockbackVelocityX = direction * MAGNET_PULL_SPEED;
      }
    }
  }
}

function updateBouncePads(scene) {
  for (const bouncePad of scene.entityGroups.get('bouncePads')) {
    bouncePad.update();
    if (bouncePad.expired) {
      scene.entityGroups.remove('bouncePads', bouncePad);
      continue;
    }
    if (bouncePad.ownerId === null) launchPlayersLandingOn(scene, bouncePad);
    else flingFirstOpponentTouching(scene, bouncePad);
  }
}

function launchPlayersLandingOn(scene, bouncePad) {
  for (const player of scene.players) {
    if (!player.inWater && bouncePad.isLandedOnBy(player)) {
      player.launchUpward(BOUNCE_PAD_LAUNCH_VELOCITY);
    }
  }
}

// The trap throws the opponent back the way they came, or away from its center if they stood
// still, then breaks.
function flingFirstOpponentTouching(scene, bouncePad) {
  for (const player of scene.players) {
    if (player.id === bouncePad.ownerId || player.inWater || !player.overlaps(bouncePad)) continue;

    const movingDirection = Math.sign(player.velocityX + player.knockbackVelocityX);
    const awayFromCenterDirection = player.x + player.width / 2 < bouncePad.x + bouncePad.width / 2 ? -1 : 1;
    const flingDirection = movingDirection === 0 ? awayFromCenterDirection : -movingDirection;
    player.freeze('light', BOUNCE_PAD_FLING_VELOCITY_X * flingDirection, BOUNCE_PAD_FLING_VELOCITY_Y);
    scene.events.emit('trap-sprung', {
      ownerId: bouncePad.ownerId,
      targetId: player.id,
      directionX: 0,
      directionY: -1,
      strength: 'light',
    });
    scene.entityGroups.remove('bouncePads', bouncePad);
    return;
  }
}

// A banana falls from above the screen onto a random open platform, but only after its marker has flashed there.
function updateBananaRain(scene) {
  for (const drop of scene.entityGroups.get('bananaDrops')) {
    drop.update();
    if (drop.ticksRemaining > 0) continue;

    scene.entityGroups.add('bananas', new Banana({ x: drop.x, y: -BANANA_HEIGHT, dropperId: null }));
    scene.entityGroups.remove('bananaDrops', drop);
  }
  if (!scene.activeModifier.bananaRainIntervalTicks) return;

  scene.ticksUntilBananaDrop--;
  if (scene.ticksUntilBananaDrop > 0) return;

  const openTops = scene.openTops.filter((openTop) => openTop.y < scene.waterLineY);
  if (openTops.length === 0) return;

  const openTop = openTops[Math.floor(scene.random.next() * openTops.length)];
  const x = openTop.x + scene.random.next() * (openTop.width - BANANA_WIDTH);
  scene.entityGroups.add('bananaDrops', new BananaDrop({ x, landingY: openTop.y }));
  scene.ticksUntilBananaDrop = scene.activeModifier.bananaRainIntervalTicks;
}

function updateBananas(scene) {
  const platforms = scene.entityGroups.get('platforms');
  for (const banana of scene.entityGroups.get('bananas')) {
    banana.update(platforms);
    if (banana.expired || banana.y + banana.height >= scene.waterLineY) {
      scene.entityGroups.remove('bananas', banana);
      continue;
    }
    const slippingPlayer = scene.players.find((player) => banana.canSlip(player) && player.overlaps(banana));
    if (!slippingPlayer) continue;

    slippingPlayer.makeSlip(BANANA_SLIP_TICKS);
    scene.recordCause(slippingPlayer.id, 'banana');
    scene.events.emit('player-slipped', { playerId: slippingPlayer.id });
    scene.entityGroups.remove('bananas', banana);
  }
}
