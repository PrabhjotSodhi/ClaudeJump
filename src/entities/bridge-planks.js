import {
  BRIDGE_PLANK_CRACK_INTERVAL_TICKS,
  BRIDGE_PLANK_CRACK_TICKS,
  BRIDGE_PLANK_FALL_GRAVITY,
  BRIDGE_PLANK_FALL_VISIBLE_TICKS,
  BRIDGE_PLANK_FIRST_CRACK_TICKS,
  TILE_SIZE,
} from '../engine/config.js';
import { Entity } from '../engine/entity.js';

const SHAKE_PIXELS = 1;
const CRACK_COLOR = '#181425';
const CRACK_SEGMENTS = [
  [7, 0, 2, 3],
  [5, 3, 3, 2],
  [8, 5, 3, 2],
  [6, 7, 3, 2],
  [9, 9, 2, 3],
  [7, 12, 2, 4],
];
const TILE_NAME_PREFIX = 'girder';

// The planks of a bridge deck: the girder tiles of one row of the level. After BRIDGE_PLANK_FIRST_CRACK_TICKS of the
// fight, one plank at a time starts cracking, every BRIDGE_PLANK_CRACK_INTERVAL_TICKS, in an order shuffled with the
// scene's seeded random. A cracking plank shakes and shows cracks for BRIDGE_PLANK_CRACK_TICKS while still solid, then
// falls out of the deck. The scene restores every plank when the next round starts.
// Each plank is { column, row, tileName, state, ticks } with state 'solid', 'cracking', 'falling' or 'fallen'.
export class BridgePlanks extends Entity {
  constructor({ row }, { level, random }) {
    super({ x: 0, y: row * TILE_SIZE, width: 0, height: TILE_SIZE });
    this.sprites = level.tileSprites;
    this.ticks = 0;
    this.planks = level.tiles
      .filter((tile) => tile.name.startsWith(TILE_NAME_PREFIX) && tile.y === row * TILE_SIZE)
      .map((tile) => ({ column: tile.x / TILE_SIZE, row, tileName: tile.name, state: 'solid', ticks: 0 }));
    this.crackOrder = this.planks.map((plank, index) => index);
    for (let index = this.crackOrder.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(random.next() * (index + 1));
      [this.crackOrder[index], this.crackOrder[swapIndex]] = [this.crackOrder[swapIndex], this.crackOrder[index]];
    }
    this.cracksStarted = 0;
  }

  update(scene) {
    this.ticks++;
    for (const plank of this.planks) {
      if (plank.state === 'solid' || plank.state === 'fallen') continue;

      plank.ticks++;
      if (plank.state === 'cracking' && plank.ticks >= BRIDGE_PLANK_CRACK_TICKS) {
        plank.state = 'falling';
        plank.ticks = 0;
        scene.removeSolidCell(plank.column, plank.row);
      } else if (plank.state === 'falling' && plank.ticks >= BRIDGE_PLANK_FALL_VISIBLE_TICKS) {
        plank.state = 'fallen';
      }
    }
    const ticksSinceFirstCrack = this.ticks - BRIDGE_PLANK_FIRST_CRACK_TICKS;
    if (
      ticksSinceFirstCrack >= 0 &&
      ticksSinceFirstCrack % BRIDGE_PLANK_CRACK_INTERVAL_TICKS === 0 &&
      this.cracksStarted < this.planks.length
    ) {
      this.startCracking(scene, this.planks[this.crackOrder[this.cracksStarted++]]);
    }
  }

  // The scene stops drawing the plank's tile, and this draws it instead, shaking.
  startCracking(scene, plank) {
    plank.state = 'cracking';
    plank.ticks = 0;
    scene.brokenTiles.add(this.tileOf(scene, plank));
  }

  tileOf(scene, plank) {
    return scene.level.tiles.find(
      (tile) =>
        tile.name.startsWith(TILE_NAME_PREFIX) &&
        tile.x === plank.column * TILE_SIZE &&
        tile.y === plank.row * TILE_SIZE,
    );
  }

  render(context) {
    for (const plank of this.planks) {
      if (plank.state === 'solid' || plank.state === 'fallen') continue;

      const sprite = this.sprites[plank.tileName];
      const x = plank.column * TILE_SIZE;
      const y = plank.row * TILE_SIZE;
      if (plank.state === 'cracking') {
        const shake = Math.floor(plank.ticks / 2) % 2 === 0 ? SHAKE_PIXELS : -SHAKE_PIXELS;
        context.drawImage(sprite, x + shake, y);
        const visibleSegments = Math.ceil((plank.ticks / BRIDGE_PLANK_CRACK_TICKS) * CRACK_SEGMENTS.length);
        context.fillStyle = CRACK_COLOR;
        for (const [offsetX, offsetY, width, height] of CRACK_SEGMENTS.slice(0, visibleSegments)) {
          context.fillRect(x + shake + offsetX, y + offsetY, width, height);
        }
      } else {
        const fallen = Math.round(0.5 * BRIDGE_PLANK_FALL_GRAVITY * plank.ticks * plank.ticks);
        context.drawImage(sprite, x, y + fallen);
      }
    }
  }
}
