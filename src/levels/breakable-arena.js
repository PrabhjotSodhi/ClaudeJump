import { TILE_SIZE } from '../engine/config.js';
import { Platform } from '../entities/platform.js';
import { solidRuns } from './level-loader.js';

// Smaller than the blast radius that knocks players back, so a blast knocks players far but only bites a chunk out of the arena.
const BLOCK_BLAST_RADIUS = 24;

export function blockOverlaps(block, rectangle) {
  return (
    block.x < rectangle.x + rectangle.width &&
    block.x + block.size > rectangle.x &&
    block.y < rectangle.y + rectangle.height &&
    block.y + block.size > rectangle.y
  );
}

export function blockIsInBlast(block, blastCenterX, blastCenterY) {
  const nearestX = Math.max(block.x, Math.min(blastCenterX, block.x + block.size));
  const nearestY = Math.max(block.y, Math.min(blastCenterY, block.y + block.size));
  const distanceX = nearestX - blastCenterX;
  const distanceY = nearestY - blastCenterY;
  return Math.sqrt(distanceX * distanceX + distanceY * distanceY) <= BLOCK_BLAST_RADIUS;
}

export class BreakableArena {
  constructor({ level, entityGroups, events }) {
    this.level = level;
    this.entityGroups = entityGroups;
    this.events = events;
  }

  // Blocks broken in a round are gone until the next one. The level itself is never changed, so the next round
  // and the thumbnails still see every block.
  restoreBlocks() {
    this.blocks = [...this.level.blocks];
    this.solidCells = this.level.solidCells.map((row) => [...row]);
    this.brokenTiles = new Set();
    this.rebuildSolids();
  }

  removeSolidCell(column, row) {
    this.solidCells[row][column] = false;
    this.rebuildSolids();
  }

  rebuildSolids() {
    const { platforms, openTops } = solidRuns(this.solidCells);
    this.entityGroups.clear('platforms');
    for (const layout of platforms) this.entityGroups.add('platforms', new Platform(layout));
    this.openTops = openTops;
  }

  breakBlocksWhere(touchesBlock) {
    const brokenBlocks = this.blocks.filter(touchesBlock);
    if (brokenBlocks.length === 0) return;

    this.blocks = this.blocks.filter((block) => !brokenBlocks.includes(block));
    for (const block of brokenBlocks) {
      const firstColumn = block.x / TILE_SIZE;
      const firstRow = block.y / TILE_SIZE;
      for (let row = firstRow; row < firstRow + block.size / TILE_SIZE; row++) {
        for (let column = firstColumn; column < firstColumn + block.size / TILE_SIZE; column++) {
          this.solidCells[row][column] = false;
        }
      }
      this.brokenTiles.add(block.tile);
      this.events.emit('block-broken', { x: block.x, y: block.y, size: block.size });
    }
    this.rebuildSolids();
    this.dropUnsupportedBouncePads(brokenBlocks);
  }

  // A pad that stood on a broken block goes with it, unless another solid cell still holds it up.
  dropUnsupportedBouncePads(brokenBlocks) {
    for (const bouncePad of this.entityGroups.get('bouncePads')) {
      const padBottomY = bouncePad.y + bouncePad.height;
      const stoodOnBrokenBlock = brokenBlocks.some(
        (block) =>
          block.y === padBottomY && block.x < bouncePad.x + bouncePad.width && block.x + block.size > bouncePad.x,
      );
      if (!stoodOnBrokenBlock) continue;
      const row = this.solidCells[padBottomY / TILE_SIZE] ?? [];
      const firstColumn = Math.floor(bouncePad.x / TILE_SIZE);
      const lastColumn = Math.floor((bouncePad.x + bouncePad.width - 1) / TILE_SIZE);
      let supported = false;
      for (let column = firstColumn; column <= lastColumn; column++) if (row[column]) supported = true;
      if (!supported) this.entityGroups.remove('bouncePads', bouncePad);
    }
  }
}
