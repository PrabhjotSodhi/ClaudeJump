// Draws the home screen icons in data/icons from the Claude character's body frame.
// Run once with `node scripts/make-icons.js`; the PNGs are committed.
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { spriteFileToPixels } from '../src/engine/sprites.js';

const BACKGROUND_COLOR = [0x26, 0x2b, 0x44, 255];
// Whole-number sprite scale per icon size, so the art stays crisp.
const SPRITE_SCALE_BY_ICON_SIZE = { 192: 4, 512: 12 };

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeAndData = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, checksum]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0;
    rows.set(rgba.subarray(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawIcon(size, sprite, scale) {
  const rgba = new Uint8Array(size * size * 4);
  for (let index = 0; index < size * size; index++) rgba.set(BACKGROUND_COLOR, index * 4);
  const offsetX = (size - sprite.width * scale) / 2;
  const offsetY = (size - sprite.height * scale) / 2;
  for (let y = 0; y < sprite.height * scale; y++) {
    for (let x = 0; x < sprite.width * scale; x++) {
      const source = (Math.floor(y / scale) * sprite.width + Math.floor(x / scale)) * 4;
      if (sprite.data[source + 3] === 0) continue;
      rgba.set(sprite.data.subarray(source, source + 4), ((offsetY + y) * size + offsetX + x) * 4);
    }
  }
  return rgba;
}

const spriteFile = JSON.parse(readFileSync('data/sprites/claude.json', 'utf8'));
const { body } = spriteFileToPixels(spriteFile);
for (const [size, scale] of Object.entries(SPRITE_SCALE_BY_ICON_SIZE)) {
  writeFileSync(`data/icons/icon-${size}.png`, encodePng(Number(size), drawIcon(Number(size), body, scale)));
}
