# 🎄 Advent of Code

Solve [Advent of Code](https://adventofcode.com) without leaving the terminal.
Fetch a day, write the answer, watch it re-run as you save, then submit.
TypeScript and Python, sharing one input.

```
  aoc                                              Historian Hysteria   ★★

  ╭─ ◂ 2024 · day 01 ▸ ─────────────────────────────────────── watching ─╮
  │                                                                      │
  │    results     output     history                                    │
  ├──────────────────────────────────────────────────────────────────────┤
  │                                                                      │
  │   ts    sample  1  ✓  11                                     164 µs  │
  │                 2  ✓  31                                      42 µs  │
  │                                                                      │
  │         input   1  ✓  765748                                 689 µs  │
  │                 2  ✓  27732508                               1.3 ms  │
  │                                                                      │
  │   ────────────────────────────────────────────────────────────────   │
  │                                                                      │
  │   py    sample  1  ✓  11                                      58 µs  │
  │                 2  ✓  31                                       8 µs  │
  │                                                                      │
  │         input   1  ✓  765748                                 704 µs  │
  │                 2  ✓  27732508                               5.4 ms  │
  │                                                                      │
  │                                                                      │
  ╰──────────────────────────────────────────────────────────────────────╯

  ←→ day · ⇥ tab · r run · s submit · esc back · h help             q quit
```

<br/>

## 🔧 Setup

### ✅ Requirements

- **Node ≥ 24** runs the TypeScript directly, with no build step
- **Python ≥ 3.12** only if you want the `py` track
- **Nothing else**: no `npm install` to run `aoc`

### 📥 Clone it

Your solutions belong in a repository of your own, which can be private. Point
`origin` at it and keep this one as `upstream`.

```bash
git clone https://github.com/Pin-ball/aoc-cli.git advent-of-code
cd advent-of-code

git remote rename origin upstream                                      # aoc-cli
git remote set-url --push upstream DISABLED                            # pull only
git remote add origin git@github.com:YOUR-USERNAME/advent-of-code.git  # yours
git push -u origin main

git fetch upstream && git merge upstream/main  # later, to catch up
```

A fork cannot be made private, and a solution in the open spoils the puzzle for
the next person.

### 🔑 Session cookie

Inputs are tied to your account.
Copy the **value** of the `session` cookie from devtools, under **Storage** in
Firefox and **Application** in Chrome. Set `AOC_USER_AGENT` to your own
repository and email, so AoC can reach you if something goes wrong.

```bash
cp .env.example .env                # fill in AOC_SESSION and AOC_USER_AGENT
ln -sf "$PWD/aoc" ~/.local/bin/aoc  # optional
aoc doctor                          # check it all works
```

<br/>

## ⭐ Running aoc

### 🖥️ Interactive view

```bash
aoc
```

The calendar opens on every year Advent of Code has run. <kbd>n</kbd> fetches a
day, <kbd>⏎</kbd> opens it, and it re-runs every time you save.

- <kbd>s</kbd> submit, after it shows you what it would send
- <kbd>r</kbd> re-check a whole year against its recorded answers
- <kbd>⇥</kbd> switch tabs: results, output, history
- <kbd>h</kbd> every other key

### ⌨️ One command at a time

```bash
aoc new -d 12 ts py     # fetch the puzzle, make the files
aoc run -d 12           # samples, then the real input
aoc submit 2            # send part 2
aoc test -y 2024        # re-check a whole year against its answers
aoc sync                # record the answers AoC has already accepted
aoc reset -y 2024 -d 5  # forget a day you fetched, once you confirm
aoc doctor              # check Node, Python, your .env and your session
```

`-y` and `-d` default to the day you last looked at. `aoc -h` lists everything.

`aoc sync` catches a fresh clone up with your account: the answers you already
gave, then each day's puzzle, sample and input. It covers every year unless
given `-y`, and never overwrites an answer already recorded.

<br/>

## ✏️ Writing a solution

Export two functions. Return `null` / `None` for a part you have not written
yet; answers are compared as trimmed strings, so an `int` and a `Number` match.

```ts
// workspace/solutions/ts/2025/day05/index.ts
export const part1 = (input: string) => 0;
export const part2 = (input: string) => 0;
```

```python
# workspace/solutions/py/2025/day05/__init__.py
def part1(input: str): ...
def part2(input: str): ...
```

Shared helpers go in `workspace/solutions/<lang>/lib/`, imported as
`../../lib/index.ts` or `from lib import ...`.

<br/>

## 📂 What gets committed

```
workspace/solutions/     your code                          # committed
workspace/puzzles/       puzzle.md  sample.txt  input.txt   # gitignored
                         meta.json                          # committed
```

[AGENTS.md](AGENTS.md) sets what an AI assistant may do here.

<br/>

## 🛠️ Working on aoc-cli

Only needed to change `cli/` itself: solving puzzles never touches this.

The tooling is dev dependencies, so `aoc` itself still runs without them.
TypeScript checks the types, [Biome](https://biomejs.dev) lints the TypeScript
and [Ruff](https://docs.astral.sh/ruff/) the Python. Ruff runs through
[uv](https://docs.astral.sh/uv/), which is the one thing to install for it.

```bash
npm ci             # TypeScript and Biome, once
npm test           # the test suite
npm run typecheck  # the types
npm run lint       # lint and formatting, as CI checks them
npm run format     # fix what can be fixed
```

[CONTRIBUTING.md](CONTRIBUTING.md) covers sending a change.

<br/>

## 📄 Licence

[AGPL-3.0](LICENSE). Use it, change it, share it. Run a modified version as a
service and you publish your changes.

Copyright © 2026 Damien Herrero
