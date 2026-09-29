import { SCREEN_HEIGHT, SCREEN_WIDTH, TILE_SIZE } from '../engine/config.js';
import { EntityGroups } from '../engine/entity-groups.js';
import { EventEmitter } from '../engine/events.js';
import { SeededRandom } from '../engine/seeded-random.js';
import { wrapAroundScreen } from '../engine/wrap-around-screen.js';
import { DEFAULT_CHARACTER_BY_PLAYER_ID } from '../entities/characters.js';
import { Platform } from '../entities/platform.js';
import { Player } from '../entities/player.js';
import { drawArenaBackground } from '../levels/arena-backgrounds.js';
import { blockName } from '../levels/level-loader.js';
import { NO_WATER_LINE_Y } from '../ui/menu-screen.js';
import { PlayerEyes } from '../vfx/player-eyes.js';

const PLAYER_ID = 'red';
const START_FLOOR_Y = SCREEN_HEIGHT - 2 * TILE_SIZE;
const ROW_GAP_MIN_Y = 48;
const ROW_GAP_STEP_Y = 8;
const ROW_GAP_STEP_COUNT = 3;
const RUN_MIN_BLOCKS = 3;
const RUN_MAX_BLOCKS = 6;
const SECOND_RUN_CHANCE = 0.5;
const MAX_REACH_X = 96;
// How far above the player the top of the screen sits once the camera follows.
const CAMERA_LEAD_Y = 180;
// Rows are generated until they reach this far above the top of the screen.
const GENERATE_AHEAD_Y = SCREEN_HEIGHT;
// Rows are dropped once they are this far below the top of the screen.
const KEEP_BELOW_Y = 2 * SCREEN_HEIGHT;

// The horizontal gap between two runs, taking the shortest way round the screen edge. 0 when they overlap.
function horizontalGap(runA, runB) {
  let shortestGap = Infinity;
  for (const shift of [-SCREEN_WIDTH, 0, SCREEN_WIDTH]) {
    const gap = Math.max(runB.x + shift - (runA.x + runA.width), runA.x - (runB.x + shift + runB.width), 0);
    shortestGap = Math.min(shortestGap, gap);
  }
  return shortestGap;
}

// True when a jump from a run on the row below can land on some run of this row.
export function isRowReachable(row, rowBelow) {
  return row.runs.some((run) => rowBelow.runs.some((runBelow) => horizontalGap(run, runBelow) <= MAX_REACH_X));
}

export class SurvivalScene {
  constructor({ sprites = {}, seed = Date.now() } = {}) {
    this.sprites = sprites;
    this.random = new SeededRandom(seed);
    this.events = new EventEmitter();
    this.entityGroups = new EntityGroups();
    this.playerEyes = new PlayerEyes();
    this.playerEyes.attach(this.events, () => this.players);
    this.waterLineY = NO_WATER_LINE_Y;
    this.backgroundDrawn = false;
    this.startRun();
  }

  get players() {
    return this.entityGroups.get('players');
  }

  startRun() {
    this.entityGroups.clear('platforms');
    this.entityGroups.clear('players');
    this.rows = [];
    this.rowCount = 0;
    this.cameraTopY = 0;
    this.addRow({ y: START_FLOOR_Y, runs: [{ x: 0, width: SCREEN_WIDTH }] });
    this.entityGroups.add(
      'players',
      new Player({
        id: PLAYER_ID,
        character: DEFAULT_CHARACTER_BY_PLAYER_ID[PLAYER_ID],
        spawnX: SCREEN_WIDTH / 2,
        spawnY: START_FLOOR_Y,
        facing: 1,
      }),
    );
    this.generateRows();
  }

  addRow({ y, runs }) {
    const platforms = runs.map(
      (run) => new Platform({ x: run.x, y, width: run.width, height: TILE_SIZE, oneWay: true }),
    );
    for (const platform of platforms) this.entityGroups.add('platforms', platform);
    this.rows.push({ index: this.rowCount++, y, runs, platforms });
  }

  randomInteger(minimum, maximum) {
    return minimum + Math.floor(this.random.next() * (maximum - minimum + 1));
  }

  randomRun(x) {
    return { x, width: this.randomInteger(RUN_MIN_BLOCKS, RUN_MAX_BLOCKS) * TILE_SIZE };
  }

  // The first run always sits within reach of a run on the row below, so every row can be climbed to.
  // A second run lands anywhere the first one leaves room for.
  generateRow(rowBelow) {
    const gapY = ROW_GAP_MIN_Y + this.randomInteger(0, ROW_GAP_STEP_COUNT - 1) * ROW_GAP_STEP_Y;
    const anchor = rowBelow.runs[this.randomInteger(0, rowBelow.runs.length - 1)];
    const first = this.randomRun(0);
    const firstBlock = Math.ceil((anchor.x - MAX_REACH_X - first.width) / TILE_SIZE);
    const lastBlock = (anchor.x + anchor.width + MAX_REACH_X) / TILE_SIZE;
    first.x = Math.max(0, Math.min(SCREEN_WIDTH - first.width, this.randomInteger(firstBlock, lastBlock) * TILE_SIZE));
    const runs = [first];

    if (this.random.next() < SECOND_RUN_CHANCE) {
      const second = this.randomRun(0);
      const leftRoom = first.x - TILE_SIZE - second.width;
      const rightStart = first.x + first.width + TILE_SIZE;
      const rightRoom = SCREEN_WIDTH - second.width - rightStart;
      if (leftRoom >= 0 || rightRoom >= 0) {
        const useRight = rightRoom >= 0 && (leftRoom < 0 || this.random.next() < 0.5);
        second.x = useRight
          ? rightStart + this.randomInteger(0, rightRoom / TILE_SIZE) * TILE_SIZE
          : this.randomInteger(0, leftRoom / TILE_SIZE) * TILE_SIZE;
        runs.push(second);
      }
    }
    return { y: rowBelow.y - gapY, runs: runs.sort((runA, runB) => runA.x - runB.x) };
  }

  generateRows() {
    while (this.rows.at(-1).y > this.cameraTopY - GENERATE_AHEAD_Y) {
      this.addRow(this.generateRow(this.rows.at(-1)));
    }
  }

  dropRowsBelowCamera() {
    const survivingRows = this.rows.filter((row) => row.y <= this.cameraTopY + KEEP_BELOW_Y);
    if (survivingRows.length === this.rows.length) return;
    for (const row of this.rows) {
      if (!survivingRows.includes(row))
        for (const platform of row.platforms) this.entityGroups.remove('platforms', platform);
    }
    this.rows = survivingRows;
  }

  update(inputByPlayerId) {
    const player = this.players[0];
    player.update(inputByPlayerId[PLAYER_ID] ?? null, this.entityGroups.get('platforms'));
    if (player.ticksSinceJump === 0) {
      this.events.emit('player-jumped', {
        playerId: player.id,
        x: player.x + player.width / 2,
        y: player.y + player.height,
      });
    }
    if (wrapAroundScreen(player)) this.events.emit('player-wrapped', { playerId: player.id, x: player.x, y: player.y });
    this.playerEyes.update();

    this.cameraTopY = Math.min(this.cameraTopY, Math.round(player.y) - CAMERA_LEAD_Y);
    this.generateRows();
    this.dropRowsBelowCamera();
    if (player.y > this.cameraTopY + SCREEN_HEIGHT) this.startRun();
  }

  render(renderer) {
    if (!this.backgroundDrawn) {
      renderer.updateBackground((context) => drawArenaBackground(context, 'rooftops'));
      this.backgroundDrawn = true;
    }

    renderer.clearGameLayer();
    renderer.clearUiLayer();
    const context = renderer.gameContext;
    context.save();
    context.translate(0, -this.cameraTopY);
    for (const row of this.rows) {
      for (const run of row.runs) {
        for (let block = 0; block < run.width / TILE_SIZE; block++) {
          const column = run.x / TILE_SIZE + block;
          context.drawImage(
            this.sprites.stoneBlocks[blockName('small', column, row.index)],
            run.x + block * TILE_SIZE,
            row.y,
          );
        }
      }
    }
    this.entityGroups
      .get('players')
      .forEach((player) => player.render(context, { sprites: this.sprites, playerEyes: this.playerEyes }));
    context.restore();
  }
}
