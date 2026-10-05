# Art direction

Large Language Mayhem looks like chunky, bold characters fighting in a quiet, moody world. The characters are the only loud thing on screen, so a player can always find themselves in a split second, even in a small GIF.

## Grid

- The game draws on a 640x360 grid. One art pixel is one grid pixel, everywhere: sprites, tiles, UI, text and effects. Never scale one piece of art up by itself.
- Light comes from the top left for every sprite, tile and panel.

## Palette

The palette is [Endesga 32](https://lospec.com/palette-list/endesga-32) plus three warm greys for platforms. Nothing else is drawn. The palette lives in `data/palette.json`.

| Ramp                       | Dark to light                                                         |
| -------------------------- | --------------------------------------------------------------------- |
| Outline                    | `#181425` `#3e2731`                                                   |
| Warm grey (platforms)      | `#181425` `#3e2731` `#585050` `#a09088` `#c8c0b8`                     |
| Cool grey (background, UI) | `#181425` `#262b44` `#3a4466` `#5a6988` `#8b9bb4` `#c0cbdc` `#ffffff` |
| Skin                       | `#733e39` `#b86f50` `#e4a672` `#e8b796` `#ead4aa`                     |
| Orange                     | `#be4a2f` `#d77643` `#f77622` `#feae34` `#fee761`                     |
| Red                        | `#3e2731` `#a22633` `#e43b44` `#f6757a`                               |
| Green                      | `#193c3e` `#265c42` `#3e8948` `#63c74d`                               |
| Blue                       | `#262b44` `#124e89` `#0099db` `#2ce8f5`                               |
| Purple                     | `#68386c` `#b55088`                                                   |

- The grey ramps end in the outline colors, so texture in the dark keeps its shape when lighting steps it down.
- Shadows shift hue, not just brightness: warm colors shade toward red and purple, cool colors toward deep blue.
- Saturation peaks in the middle of a ramp. The lightest steps are soft, never neon.
- No pink or purple grading over the scene. Purple is a character color only.

## Characters

- Characters are AI logos and mascots. A logo character's body is the logo's shape drawn as pixel art, like Claude's orange spark. A mascot is one chunky, round head-body blob.
- The body is about 28x28, drawn in a 32x32 frame so the outlines and squash fit. The hitbox is 24x28.
- No animated limbs. A mascot may have stubby arms and legs as part of its one body shape. Motion comes from hopping, squash and stretch, and the eyes.
- Every character has two big googly eyes: 7 pixel white discs with a `#3e2731` rim and a 3 pixel dark pupil. They must leave room for the shape that makes the character recognizable: the spark's rays, the mascot's face window. The engine draws them on top of the body from `src/vfx/googly-eyes.js`. Each pupil lags behind the body's motion, flies up on a jump and rattles on a hit.
- Silhouettes read as a solid shape at thumbnail size. Texture such as fur comes from a broken outline edge and a few darker clusters, never from noise.
- Two outlines: `#3e2731` all around, then a 1 pixel `#ffffff` outer outline. The white outline is what separates a character from any background.
- Body colors are saturated, from the middle of a ramp, with one hue-shifted shadow and one highlight. No more than 5 colors per character, plus the outlines.
- One body frame per character. Squash, stretch and the eyes are added by the engine.
- Characters are always fully lit, so they stay the loudest thing on screen in the dark.

## Platforms and levels

- Arenas are loose clusters of stone blocks, big 32x32 and small 16x16, with small gaps and offsets. Never one smooth slab. Each block reads as its own object because each one can break on its own.
- Blocks use the warm grey ramp with a `#3e2731` outline, a light top left edge, a dark bottom right edge and one or two chips. No moss, no noise. Two variants per size so clusters do not look tiled.
- Steel girders hang on chains that run off the top of the screen. They use the cool grey ramp with a few rivets and never break, so they must read as a different material from stone at a glance.
- Each arena has its own background of three layers (far, mid, near) in the cool grey ramp, with checker dither for mist: harbor cranes and containers, cave spikes, a night skyline, cooling towers and data halls. The far layer is lightest, the near layer darkest. A few small lit windows or lights are fine. It stays low contrast and never competes with the characters.
- Arenas use flat, overcast light.

## Effects

- Effects use the palette and whole pixels. Sparks take the hitting player's color. Dust uses cool greys.
- Nothing that can hurt a player enters from off screen without a warning marker.

## UI

- Panels are drawn from a 9-slice: a `#3e2731` border, a `#262b44` fill, and a 1 pixel `#3a4466` inner highlight on the top edge.
- The pixel font is drawn at 1x for body text and 2x for titles.
- Selected items use `#feae34`. Player tags use the player's body color.

## Sprite files

- Sprites are text grids in `data/sprites/*.json`: each row is a string, and each character is a key into that file's color map (for example `o` for outline, `.` for empty). The engine turns them into canvases on load.
- One file per character or tileset, with named frames.
