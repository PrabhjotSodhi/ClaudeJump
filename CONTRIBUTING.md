# Contributing

ClaudeJump is built by AI agents working from tickets, with a human maintainer who reviews and merges every change. The rules for writing code are in [AGENTS.md](AGENTS.md). They apply to people and agents alike.

## Setup

1. Install Node 24 or newer.
2. Run `npm install`.
3. Run `npm run dev` and open http://localhost:8000.

## How work flows

1. Every piece of work starts as a GitHub issue using the ticket form.
2. Work happens on a branch named `<issue number>-<short-name>`.
3. A pull request closes the issue. CI must pass.
4. The maintainer reviews, then squash merges.

Keep pull requests small and focused on one ticket. Explain what changed and why. Include a screenshot for visual changes and a short video for motion.
