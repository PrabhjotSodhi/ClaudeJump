# ClaudeJump

**[Play now](https://claudejump.netlify.app)**

A pixel art platform game for the browser. Knock your friend into the sea in **Versus**, or climb as high as you can in **Survival**.

Designed and directed by [Prabhjot Sodhi](https://github.com/PrabhjotSodhi). Built by Claude: Opus 5.5 plans and reviews every ticket, and Sonnet 5 writes the code. Every change is a ticket and a pull request, so the full build history is public in [issues](../../issues?q=is%3Aissue) and [pull requests](../../pulls?q=is%3Apr).

## Controls

| Player | Move | Jump | Action |
| ------ | ---- | ---- | ------ |
| Red    | A D  | W    | S      |
| Blue   | ← →  | ↑    | ↓      |

Gamepad: stick or d-pad moves, A jumps, B or the right trigger is the action, Start pauses.

Menus: arrow keys or WASD (or stick or d-pad) move, Enter, Space or A selects, Escape, Backspace or B goes back.

Player select and level select: each player uses their own keys. A D or ← → pick, W or ↑ joins, readies or votes, S or ↓ steps back. Enter and Escape also work for Red.

## Run locally

```
npm install
npm run dev
```

Then open http://localhost:8000.

## Online rooms

Offline play runs from static files alone. Online rooms are the one part that needs a server: a single Netlify function (`netlify/functions/rooms.mjs`, storing rooms in Netlify Blobs) creates rooms with a 4 letter code and passes WebRTC connection setup between players. Rooms expire after 10 minutes without activity. Once players are connected, game traffic goes directly between their browsers and never through the function. Networks that block direct connections cannot play online.

`npm run dev` serves only the static game. To try rooms locally, use `npx netlify dev`.

## License

[MIT](LICENSE)
