# Contributing to aoc-cli

Changes to the harness are welcome: bug fixes, a new language, a better screen.
Puzzle solutions are not; they belong in your own repository.

## Where a change comes from

Your solutions repository cannot send a pull request here, and should not: it holds your answers.

Fork [aoc-cli](https://github.com/Pin-ball/aoc-cli) separately, make the change on a branch of that fork, and open the pull
request from there.

## Before you open it

You need the requirements from the README, plus [uv](https://docs.astral.sh/uv/) for Ruff.

```bash
npm ci
npm test
npm run typecheck
npm run lint
```

CI runs the same four. `npm test` must pass for a pull request to be merged; the others should, and a failing one will be pointed out.

## What to keep in mind

- `aoc` has no runtime dependencies, and should keep having none. Tooling goes in `devDependencies`.
- Node strips types rather than compiling them: no enums, no namespaces, no parameter properties. `npm run typecheck` refuses them.
- `cli/core/` holds logic and must not import from anything above it.
- Never commit `input.txt`, `sample.txt` or `puzzle.md`, and never a session cookie. Advent of Code asks that its content not be redistributed.
