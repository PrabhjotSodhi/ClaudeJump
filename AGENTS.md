# ClaudeJump

ClaudeJump is a pixel art platform game that runs in the browser. Two players share one keyboard in **Versus** and knock each other into the sea with cards. One player climbs as high as possible in **Survival** while rockets and crabs try to stop them.

The game is built in plain JavaScript with a 2D canvas for drawing and one WebGL shader pass on top. There is no build step. The engine draws onto small low resolution layers, treats everything in the world as an entity with `update()` and `render()`, and keeps images, config and shaders in data folders.

## Never compromise on

1. **Crisp pixels.** Everything is drawn at 640x360 and scaled up by a whole number. Nothing blurs, nothing is drawn between pixels.
2. **The same game on every machine.** Game logic runs at a fixed 60 ticks per second. The same inputs always produce the same state. This is what makes replays and online play possible later.
3. **Runs anywhere.** Any modern browser on Windows, Mac and Linux, straight from static files. Offline play needs nothing else. Online rooms are the one part that needs a server: a single Netlify function that hands out room codes and relays connection setup. Game traffic never goes through it, and nothing loads `online-connection.js` until a player chooses online.

## Design rules

- Nothing that hurts a player may enter from off screen without a warning marker first.

## Glossary

- **tick**: one fixed step of game logic, 1/60 of a second.
- **input record**: one player's controls for one tick, such as `{ left, right, jump }`.
- **entity**: anything that lives in the world and has `update()` and `render()`. Players, platforms, rockets and crabs are entities.
- **scene**: one screen of the game with its own rules: title, Versus or Survival.
- **layer**: one 640x360 canvas. The background, game and UI layers are combined by the shader.
- **event**: a message that something happened, such as a player falling in the water.

## How it works

Ticks drive the game and events report what happened.

1. Every tick, the current scene receives one input record per player and updates its entities in a fixed order. Game state only changes here.
2. When something notable happens, the code emits an event.
3. Particles, sounds, screen shake and the HUD listen to events. They never change game state.
4. Once per animation frame, entities render onto the layers and `window.js` combines the layers through the shader.

Rules that keep the game deterministic:

- `update()` code never reads the keyboard, the clock, the DOM or `Math.random()`. It uses input records, tick counts and `seeded-random.js`.
- `render()` code may read anything but never changes game state.

## Where code lives

- `src/engine/` runs any scene: the tick loop, window and shader, renderer, input, events, entities, assets, sounds, and the online connection.
- `netlify/` holds online rooms: `functions/rooms.mjs` is the one Netlify function and `rooms/` holds the room logic it calls. It is the only code that is not static files, and `@netlify/blobs` is its only dependency.
- `src/entities/` holds the things in the world: player, platform, rocket, crab.
- `src/scenes/` holds the rules of each screen: title, Versus, Survival.
- `src/levels/` holds the level loader and the Versus background.
- `src/cards/` holds card definitions and a player's hand.
- `src/ui/` holds the pixel font and HUD.
- `src/vfx/` holds effects that only listen to events: particles, sparks, water, clouds, screen shake.
- `data/` holds `config/`, `levels/` (tile grid files), `images/entities/<type>/<action>/`, `fonts/`, `shaders/` and `sfx/`.
- `tests/` holds `node --test` tests for game logic.

Put every file in the folder that matches its job, even when it is the only file there.

## Writing code

- Use full, descriptive names: `player`, `platform`, `context`, `accumulatedMilliseconds`. Never `p`, `r`, `ctx` or `acc`. `x` and `y` for coordinates are fine.
- Name files in kebab case after what they hold: `physics-entity.js` exports `PhysicsEntity`.
- Write the simplest code that works and reads well to a human. No abstraction until there is a second use. No options nobody asked for.
- Code describes the current state only. Never write comments like "changed from", "now uses" or "previously". Git holds the history.
- Comments are rare. Use them for how a thing is meant to be used, or for a trap the code cannot show. Never narrate what a line does.
- Tune numbers live in `src/engine` or entity config, not scattered through logic.
- Remove code your change made unused. Leave unrelated code alone.

## Hit every surface

Before calling work done, check which of these your change touches and confirm each one:

- Both scenes: Versus and Survival.
- Both players: red and blue.
- Both control types: keyboard and gamepad.
- Small and large windows: the canvas still scales by a whole number with no blur.

## Verifying

- `npm test` runs the game logic tests. Changes to game logic ship with a focused test.
- `npm run format:check` must pass. `npm run format` fixes it.
- `npm run dev` serves the game at http://localhost:8000. Play what you changed.
- Test observable behavior: scores, positions after N ticks, events emitted. Do not write tests that mirror the implementation.
- Dev mode drives ticks by hand, which works even in a hidden tab where `requestAnimationFrame` is paused. Open `http://localhost:8000/?dev` and, from the console or a script:
  ```js
  window.claudeJump.step(60, {
    red: { left: false, right: true, jump: false },
    blue: { left: false, right: false, jump: false },
  });
  window.claudeJump.render();
  ```
  `step` runs the given number of ticks (one input record applied every tick, or an array of records applied one per tick) and returns a snapshot of phase, wins and player positions. `render` draws the current state once, so a screenshot taken right after matches what `step` left behind.
- Dev mode starts on Harbor. Add a level file name to start elsewhere: `http://localhost:8000/?dev&level=server-farm`.

## Tickets and pull requests

- Work comes from GitHub issues. Each issue has a goal, acceptance criteria and what is out of scope. Meet every criterion and build nothing out of scope.
- Branch name: `<issue number>-<short-name>`, for example `3-cards`.
- One concern per PR. If the description says "also", split it.
- Title in conventional commit form, plain language: `feat(cards): rocket card knocks players back`.
- Body: the problem in a sentence or two, then how you solved it, then `Closes #<issue>`. End with the model and harness that did the work, for example `Built by sonnet-5 via Claude Code`.
- Visual changes need a screenshot. Motion or timing needs a short video. Upload them to the PR, never commit them.
- The maintainer reviews and merges every PR. Never merge your own.

## Plans and notes

- Do not commit plans, research notes or scratch files. Keep them outside the repo.
- The GitHub issue tracks the work. The merged PR is the record.
