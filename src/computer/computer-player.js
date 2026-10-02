// Tune numbers for computer players, in pixels and ticks.
const PLAYER_WIDTH = 24;
const PLAYER_HEIGHT = 28;
// Room above a hop's path that must be free of other platforms.
const HOP_HEADROOM = 16;
// While rising, a platform this far above the head, and this far ahead, stops sideways drift.
const HEAD_CLEARANCE = 40;
const HEAD_LOOKAHEAD = 6;
// A jump and the air jump at its top rise about this high together, and a jump carries a player about this far
// sideways, with room to spare.
const JUMP_RISE = 110;
const JUMP_REACH = 100;
// When nothing closer leads to the target, a jump with the air jump is tried across a gap this wide.
const LONG_JUMP_REACH = 150;
// Crossing a gap wider than this takes a full jump rather than a short hop.
const HOP_GAP = 40;
// Surfaces at the same height closer than this count as one, since players walk over the small gaps in a cluster.
const STEP_GAP = 8;
// How close to an edge a computer walks before it stops or jumps.
const EDGE_MARGIN = 4;
const CLOSE_ENOUGH_X = 6;
const TAKEOFF_GAP = 8;
const STILL_SPEED = 0.5;
const SAME_LEVEL_Y = 12;
const SHOVE_RANGE_X = 34;
const STRIKE_DISTANCE = 22;
const SHOVE_RANGE_Y = 24;
const CARD_RANGE_X = 180;
const CARD_RANGE_Y = 48;
// How long each shove is held, in turn, so some are taps and some are full charges.
const SHOVE_HOLD_TICKS = [32, 12, 32, 24, 6];
const MODIFIER_PICK_DELAY_TICKS = 40;
const JUMP_HOLD_TICKS = 14;
const HOP_HOLD_TICKS = 6;
// Rising slower than this counts as the top of a jump.
const APEX_SPEED = 2;

function idleInput() {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    action: false,
    confirm: false,
    pause: false,
  };
}

function centerX(rectangle) {
  return rectangle.x + rectangle.width / 2;
}

function feetY(player) {
  return player.y + player.height;
}

// The tops a player can stand on, from the platforms: each platform's top minus any part another platform sits on,
// with neighbors at the same height joined. Each is { x, y, width }, y being the top.
export function standingSurfaces(platforms, waterLineY) {
  const pieces = [];
  for (const platform of platforms) {
    if (platform.y >= waterLineY) continue;
    const covers = platforms
      .filter((other) => other !== platform && other.y + other.height === platform.y)
      .map((other) => ({ start: other.x, end: other.x + other.width }))
      .sort((first, second) => first.start - second.start);
    let start = platform.x;
    const end = platform.x + platform.width;
    for (const cover of covers) {
      if (cover.end <= start || cover.start >= end) continue;
      if (cover.start > start) pieces.push({ x: start, y: platform.y, width: cover.start - start });
      start = Math.max(start, cover.end);
    }
    if (start < end) pieces.push({ x: start, y: platform.y, width: end - start });
  }
  pieces.sort((first, second) => first.y - second.y || first.x - second.x);
  const surfaces = [];
  for (const piece of pieces) {
    const last = surfaces.at(-1);
    if (last && last.y === piece.y && piece.x - (last.x + last.width) <= STEP_GAP) {
      last.width = Math.max(last.width, piece.x + piece.width - last.x);
    } else {
      surfaces.push({ ...piece });
    }
  }
  return surfaces;
}

// The surface a body centered at x stands on, the one under most of its width.
function surfaceUnder(surfaces, x, y) {
  let best = null;
  let bestOverlap = 0;
  for (const surface of surfaces) {
    if (surface.y !== y) continue;
    const overlap =
      Math.min(x + PLAYER_WIDTH / 2, surface.x + surface.width) - Math.max(x - PLAYER_WIDTH / 2, surface.x);
    if (overlap > bestOverlap) {
      best = surface;
      bestOverlap = overlap;
    }
  }
  return best;
}

// The highest surface below a point that a body falling straight down there would land on.
function surfaceBelow(surfaces, x, y) {
  let best = null;
  for (const surface of surfaces) {
    if (surface.y < y || x < surface.x || x > surface.x + surface.width) continue;
    if (!best || surface.y < best.y) best = surface;
  }
  return best;
}

// Horizontal distance from a point to the nearest part of a surface, zero when above it.
function distanceToSurface(surface, x) {
  if (x < surface.x) return surface.x - x;
  if (x > surface.x + surface.width) return x - (surface.x + surface.width);
  return 0;
}

// The horizontal gap between two surfaces, zero when one is above the other.
function surfaceGap(first, second) {
  return Math.max(0, first.x - (second.x + second.width), second.x - (first.x + first.width));
}

function isPartOf(platform, surface) {
  return (
    platform.y === surface.y && platform.x >= surface.x && platform.x + platform.width <= surface.x + surface.width
  );
}

// The space a hop from one surface to the other passes through, where another platform would block it.
function hopSpace(from, to) {
  const top = Math.min(from.y, to.y) - PLAYER_HEIGHT - HOP_HEADROOM;
  const bottom = Math.max(from.y, to.y) - 1;
  if (to.x >= from.x + from.width) return { left: from.x + from.width - PLAYER_WIDTH, right: to.x, top, bottom };
  if (to.x + to.width <= from.x) return { left: to.x + to.width, right: from.x + PLAYER_WIDTH, top, bottom };
  // Above and overlapping: the jump starts beside the goal's nearer end.
  const fromLeft = to.x - from.x >= from.x + from.width - (to.x + to.width);
  return fromLeft
    ? { left: to.x - 2 * PLAYER_WIDTH, right: to.x, top, bottom }
    : { left: to.x + to.width, right: to.x + to.width + 2 * PLAYER_WIDTH, top, bottom };
}

function isHopClear(platforms, from, to) {
  if (to.y > from.y && surfaceGap(from, to) === 0) return true;
  const space = hopSpace(from, to);
  return !platforms.some(
    (platform) =>
      !isPartOf(platform, from) &&
      !isPartOf(platform, to) &&
      platform.x < space.right &&
      platform.x + platform.width > space.left &&
      platform.y < space.bottom &&
      platform.y + platform.height > space.top,
  );
}

// platforms is null to allow a hop whatever is in its way.
function canHop(platforms, from, to, reach) {
  if (from === to || from.y - to.y > JUMP_RISE || surfaceGap(from, to) > reach) return false;
  return !platforms || isHopClear(platforms, from, to);
}

// Plays one seat from what it can see of the game. Every choice comes from the scene's state and tick count, never
// the clock or Math.random, so a match with computer players replays the same way from the same seed. Call
// inputFor once per tick; it returns that seat's input record.
export class ComputerPlayer {
  constructor(playerId, seatIndex) {
    this.playerId = playerId;
    this.seatIndex = seatIndex;
    this.jumpHeldTicks = 0;
    this.actionHeldTicks = 0;
    this.shovesStarted = 0;
    // The surface the last jump or step off an edge was aimed at.
    this.airGoal = null;
  }

  inputFor(scene) {
    const input = idleInput();
    const player = scene.players.find((candidate) => candidate.id === this.playerId);
    if (scene.phase === 'modifier') {
      input.jump = scene.modifierPickerId === this.playerId && scene.tickCount % MODIFIER_PICK_DELAY_TICKS === 0;
      return input;
    }
    if (scene.phase !== 'fight' || !player || player.inWater || player.isFrozen) return this.release(input);

    const platforms = scene.entityGroups.get('platforms');
    const surfaces = standingSurfaces(platforms, scene.waterLineY);
    const target = this.pickTarget(scene, player, surfaces);
    this.steer(input, player, platforms, surfaces, target);
    this.fight(input, scene, player);
    return input;
  }

  release(input) {
    this.jumpHeldTicks = 0;
    this.actionHeldTicks = 0;
    return input;
  }

  opponents(scene, player) {
    return scene.players.filter((other) => other !== player && !other.inWater);
  }

  nearestOpponent(scene, player) {
    let nearest = null;
    for (const other of this.opponents(scene, player)) {
      const distance = Math.abs(centerX(other) - centerX(player)) + Math.abs(other.y - player.y);
      if (!nearest || distance < nearest.distance) nearest = { player: other, distance };
    }
    return nearest?.player ?? null;
  }

  // Where to go: the hill in Hold the hill, away from the bomb unless holding it, an open crate when empty handed,
  // otherwise beside the nearest opponent. A point { x, y } at feet height, with airborne set for an opponent in the
  // air, or null to stay put.
  pickTarget(scene, player, surfaces) {
    const rules = scene.modeRules;
    if (scene.mode === 'hill' && rules?.zone) {
      return { x: centerX(rules.zone), y: rules.zone.y + rules.zone.height };
    }
    if (scene.mode === 'bomb' && rules?.holderId && rules.holderId !== player.id) {
      const holder = scene.players.find((other) => other.id === rules.holderId);
      if (holder) {
        const awayX = centerX(holder) < centerX(player) ? centerX(holder) + 200 : centerX(holder) - 200;
        return { x: awayX, y: feetY(player) };
      }
    }
    const crate = scene.entityGroups.get('crates')[0];
    if (!player.heldCardName && crate?.landing && crate.isFalling) {
      return { x: crate.landing.x + crate.width / 2, y: crate.landing.y + crate.height };
    }
    const opponent = this.nearestOpponent(scene, player);
    if (!opponent) return null;
    // Come at an opponent from the middle of their surface, so the shove sends them toward the nearer edge.
    const opponentX = centerX(opponent);
    if (!opponent.onGround) return { x: opponentX, y: feetY(opponent), airborne: true };
    const opponentSurface = surfaceUnder(surfaces, opponentX, feetY(opponent));
    if (!opponentSurface) return { x: opponentX, y: feetY(opponent) };
    const side = opponentX > centerX(opponentSurface) ? -1 : 1;
    return { x: opponentX + side * STRIKE_DISTANCE, y: feetY(opponent) };
  }

  // Walks and jumps toward the target over surfaces it can reach, never off an edge with nothing below.
  steer(input, player, platforms, surfaces, target) {
    const x = centerX(player);
    const standing = player.onGround ? surfaceUnder(surfaces, x, feetY(player)) : null;
    if (this.jumpHeldTicks > 0) {
      this.jumpHeldTicks--;
      input.jump = this.jumpHeldTicks > 0 && player.velocityY < 0;
    }

    if (!standing) {
      this.steerInAir(input, player, surfaces, target);
      this.keepHeadClear(input, player, platforms);
      return;
    }
    this.airGoal = null;
    if (!target) return;
    // An airborne opponent or a shove being charged is followed only along the surface underfoot.
    const goal =
      target.airborne || this.actionHeldTicks > 0
        ? standing
        : this.nextSurface(platforms, surfaces, standing, x, target);
    if (goal === standing) {
      this.walkWithin(input, standing, x, target.x);
      return;
    }
    this.airGoal = goal;
    if (goal.y > standing.y && distanceToSurface(goal, x) === 0) {
      // Below, and reached by stepping off the edge it sticks out from.
      const goalSide = centerX(goal) < centerX(standing) ? -1 : 1;
      input.left = goalSide < 0;
      input.right = goalSide > 0;
      return;
    }
    // Take off from beside the goal, not under it, so the jump never hits its underside, and from no further out
    // than the edge of the surface underfoot.
    const leftTakeoffX = goal.x - PLAYER_WIDTH / 2 - TAKEOFF_GAP;
    const rightTakeoffX = goal.x + goal.width + PLAYER_WIDTH / 2 + TAKEOFF_GAP;
    const sideTakeoffX = Math.abs(leftTakeoffX - x) < Math.abs(rightTakeoffX - x) ? leftTakeoffX : rightTakeoffX;
    const takeoffX = Math.max(
      standing.x + PLAYER_WIDTH / 2,
      Math.min(standing.x + standing.width - PLAYER_WIDTH / 2, sideTakeoffX),
    );
    if (Math.abs(takeoffX - x) <= CLOSE_ENOUGH_X) {
      // A climb starts from standing still, so the run up does not carry it under the goal's underside.
      const climbing = goal.y < standing.y;
      if (climbing && Math.abs(player.velocityX) > STILL_SPEED && surfaceGap(standing, goal) === 0) return;
      this.startJump(input, climbing || surfaceGap(standing, goal) > HOP_GAP ? JUMP_HOLD_TICKS : HOP_HOLD_TICKS);
      return;
    }
    input.left = takeoffX < x;
    input.right = takeoffX > x;
  }

  // Moves toward toX but stops short of the surface's edges.
  walkWithin(input, surface, x, toX) {
    const leftLimit = surface.x + PLAYER_WIDTH / 2 + EDGE_MARGIN;
    const rightLimit = surface.x + surface.width - PLAYER_WIDTH / 2 - EDGE_MARGIN;
    const clampedX = Math.max(leftLimit, Math.min(rightLimit, toX));
    if (Math.abs(clampedX - x) <= CLOSE_ENOUGH_X) return;
    input.left = clampedX < x;
    input.right = clampedX > x;
  }

  // A full jump to climb, a short hop to cross a gap at the same height or lower.
  startJump(input, holdTicks = JUMP_HOLD_TICKS) {
    if (this.jumpHeldTicks > 0) return;
    this.jumpHeldTicks = holdTicks;
    input.jump = true;
  }

  // The surface to head for next: the first hop on the shortest way to where the target stands, or toward the
  // reachable surface closest to the target when there is no way there.
  nextSurface(platforms, surfaces, standing, x, target) {
    const targetSurface = surfaceBelow(surfaces, target.x, target.y - SAME_LEVEL_Y) ?? standing;
    // Clear hops first, then hops a platform may get in the way of, then long jumps.
    let firstHopBySurface = this.firstHops(platforms, surfaces, standing, JUMP_REACH);
    if (!firstHopBySurface.has(targetSurface)) firstHopBySurface = this.firstHops(null, surfaces, standing, JUMP_REACH);
    if (!firstHopBySurface.has(targetSurface)) {
      firstHopBySurface = this.firstHops(null, surfaces, standing, LONG_JUMP_REACH);
    }
    if (firstHopBySurface.has(targetSurface)) return firstHopBySurface.get(targetSurface);
    let best = standing;
    let bestDistance = distanceToSurface(standing, target.x) + Math.abs(standing.y - targetSurface.y);
    for (const [surface, firstHop] of firstHopBySurface) {
      const distance = distanceToSurface(surface, target.x) + Math.abs(surface.y - targetSurface.y);
      if (distance < bestDistance) {
        best = firstHop;
        bestDistance = distance;
      }
    }
    return best;
  }

  // For every surface reachable from standing in hops no wider than reach, the first hop on the fewest-hop way there.
  firstHops(platforms, surfaces, standing, reach) {
    const firstHopBySurface = new Map([[standing, standing]]);
    const queue = [standing];
    while (queue.length > 0) {
      const from = queue.shift();
      for (const to of surfaces) {
        if (firstHopBySurface.has(to) || !canHop(platforms, from, to, reach)) continue;
        firstHopBySurface.set(to, from === standing ? to : firstHopBySurface.get(from));
        queue.push(to);
      }
    }
    return firstHopBySurface;
  }

  // In the air: head for the surface the jump was aimed at while it can still be reached, otherwise drift over the
  // surface it will land on, and use the air jump when there is nothing below.
  steerInAir(input, player, surfaces, target) {
    const x = centerX(player);
    const goalX = target?.x ?? x;
    const goal = this.airGoal && (player.velocityY < 0 || feetY(player) <= this.airGoal.y) ? this.airGoal : null;
    if (goal && feetY(player) > goal.y) {
      // Still below its top: use the air jump at the top of the first jump, and wait to move over it until the feet
      // clear it when right beside it.
      const nearTop = player.velocityY > -APEX_SPEED;
      if (nearTop && player.airJumpAvailable && this.jumpHeldTicks === 0) this.startJump(input);
      const besideGoal = distanceToSurface(goal, x) <= PLAYER_WIDTH;
      if (besideGoal && distanceToSurface(goal, x) > PLAYER_WIDTH / 2) return;
      if (!besideGoal) {
        input.left = centerX(goal) < x;
        input.right = !input.left;
        return;
      }
    }
    const below = goal ?? surfaceBelow(surfaces, x, feetY(player));
    if (below) {
      const safeX = Math.max(
        below.x + PLAYER_WIDTH / 2 + EDGE_MARGIN,
        Math.min(below.x + below.width - PLAYER_WIDTH / 2 - EDGE_MARGIN, goalX),
      );
      input.left = safeX < x - CLOSE_ENOUGH_X;
      input.right = safeX > x + CLOSE_ENOUGH_X;
      return;
    }
    let nearest = null;
    for (const surface of surfaces) {
      if (surface.y < feetY(player) - JUMP_RISE) continue;
      const distance = distanceToSurface(surface, x);
      if (!nearest || distance < nearest.distance) nearest = { surface, distance };
    }
    if (!nearest) return;
    this.airGoal = nearest.surface;
    input.left = centerX(nearest.surface) < x;
    input.right = !input.left;
    if (player.velocityY > 0 && player.airJumpAvailable && this.jumpHeldTicks === 0) this.startJump(input);
  }

  // While rising, does not drift in under a platform just above, so the jump is not cut short on its underside.
  keepHeadClear(input, player, platforms) {
    if (player.velocityY >= 0) return;
    const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (direction === 0) return;
    const aheadLeft = player.x + direction * HEAD_LOOKAHEAD;
    const blocked = platforms.some(
      (platform) =>
        platform.y + platform.height <= player.y &&
        platform.y + platform.height > player.y - HEAD_CLEARANCE &&
        platform.x < aheadLeft + player.width &&
        platform.x + platform.width > aheadLeft,
    );
    if (blocked) {
      input.left = false;
      input.right = false;
    }
  }

  // Standing, shoves an opponent in reach, holding each shove for a different time, and plays a held card at a nearby opponent.
  fight(input, scene, player) {
    if (!player.onGround) {
      // A shove or card is only started standing, so it never pulls a jump off course.
      this.actionHeldTicks = 0;
      return;
    }
    if (this.actionHeldTicks > 0) {
      this.actionHeldTicks--;
      input.action = this.actionHeldTicks > 0;
      input.jump = false;
      return;
    }
    const opponent = this.nearestOpponent(scene, player);
    if (!opponent || player.slipTicksRemaining > 0) return;
    const dx = centerX(opponent) - centerX(player);
    const dy = Math.abs(opponent.y - player.y);
    if (player.heldCardName) {
      if (Math.abs(dx) < CARD_RANGE_X && dy < CARD_RANGE_Y && scene.tickCount % 20 === this.seatIndex * 5) {
        input.left = dx < 0;
        input.right = dx > 0;
        input.action = true;
        this.actionHeldTicks = 1;
      }
      return;
    }
    if (Math.abs(dx) > SHOVE_RANGE_X || dy > SHOVE_RANGE_Y || player.shoveCooldownTicksRemaining > 0) return;
    input.left = dx < 0;
    input.right = dx > 0;
    input.action = true;
    this.actionHeldTicks = SHOVE_HOLD_TICKS[(this.shovesStarted + this.seatIndex) % SHOVE_HOLD_TICKS.length];
    this.shovesStarted++;
  }
}
