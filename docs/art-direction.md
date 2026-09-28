# Art direction

ClaudeJump looks like chunky, bold characters fighting in a quiet, moody world. The characters are the only loud thing on screen, so a player can always find themselves in a split second, even in a small GIF.

## Grid

- The game draws on a 640x360 grid. One art pixel is one grid pixel, everywhere: sprites, tiles, UI, text and effects. Never scale one piece of art up by itself.
- Light comes from the top left for every sprite, tile and panel.

## Palette

The palette is [Endesga 32](https://lospec.com/palette-list/endesga-32) plus three warm greys for platforms. Nothing else is drawn. The palette lives in `data/palette.json`.

| Ramp                       | Dark to light                                               |
| -------------------------- | ----------------------------------------------------------- |
| Outline                    | `#181425` `#3e2731`                                         |
| Warm grey (platforms)      | `#585050` `#a09088` `#c8c0b8`                               |
| Cool grey (background, UI) | `#262b44` `#3a4466` `#5a6988` `#8b9bb4` `#c0cbdc` `#ffffff` |
| Skin                       | `#733e39` `#b86f50` `#e4a672` `#ead4aa`                     |
| Orange                     | `#be4a2f` `#d77643` `#f77622` `#feae34` `#fee761`           |
| Red                        | `#3e2731` `#a22633` `#e43b44` `#f6757a`                     |
| Green                      | `#193c3e` `#265c42` `#3e8948` `#63c74d`                     |
| Blue                       | `#262b44` `#124e89` `#0099db` `#2ce8f5`                     |
| Purple                     | `#68386c` `#b55088`                                         |

- Shadows shift hue, not just brightness: warm colors shade toward red and purple, cool colors toward deep blue.
- Saturation peaks in the middle of a ramp. The lightest steps are soft, never neon.
- No pink or purple grading over the scene. Purple is a character color only.

## Characters

- A 24x28 hitbox, drawn in a 32x32 frame so the outlines and squash fit.
- Boxy, round silhouettes that read as a solid shape at thumbnail size. Legs are about 2 pixels tall. Arms, when shown, belong to the held pickup.
- Two outlines: `#3e2731` all around, then a 1 pixel `#ffffff` outer outline. The white outline is what separates a character from any background.
- Big, simple eyes carry the personality. A face reads in 4 to 6 pixels.
- Body colors are saturated, from the middle of a ramp, with one hue-shifted shadow and one highlight. No more than 5 colors per character, plus the outlines.
- Animation: idle (2 frames), run (4), jump (1), fall (1). Squash and stretch is added by the engine.
- AI characters are original lookalikes: shape, color and personality evoke a model, never its logo or official mark.

## Platforms and levels

- Tiles are 16x16. Platforms use the warm grey ramp with a light top edge, a dark bottom edge and a few rivets or cracks. Keep the texture sparse.
- The background is cool greys and deep blue only, low contrast, and one or two values darker than the platforms. It never competes with the characters.
- Each level gets a mood from the shader: a fog color, a fog density and the number of lights. The tiles stay the same.

## Lighting

- The scene is drawn normally, and a separate light layer stores a light level from 0 to 3 per pixel.
- The shader moves each pixel down its own ramp by (3 - light level) steps, using a lookup table built from the palette. Light never creates new colors, so the picture stays pixel art.
- Lights are three rings (levels 1, 2, 3), with radii that breathe slowly. Rockets, bombs, sparks, explosions and level lamps carry lights.
- Fog is a slow scrolling noise darkening, snapped to whole pixels, plus a light vignette.

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
