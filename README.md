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

- **Node ≥ 23.6** runs the TypeScript directly, with no build step
- **Python ≥ 3.12** only if you want the `py` track
- **Nothing else**: `aoc-cli` has no dependencies

### 📥 Clone it

Your solutions belong in a repository of your own, which can be private. Point
`origin` at it and keep this one as `upstream`.

```bash
git clone https://github.com/Pin-ball/aoc-cli.git advent-of-code
cd advent-of-code

git remote rename origin upstream                                      # aoc-cli
git remote add origin git@github.com:YOUR-USERNAME/advent-of-code.git  # yours
git push -u origin main

git fetch upstream && git merge upstream/main  # later, to catch up
```

A fork cannot be made private, and a solution in the open spoils the puzzle for
the next person.

### 🔑 Session cookie

Inputs are tied to your account.
Copy the **value** of the `session` cookie from devtools, under **Storage** in
Firefox and **Application** in Chrome.

```bash
cp .env.example .env               # paste it into AOC_SESSION
ln -s "$PWD/aoc" ~/.local/bin/aoc  # optional
```

<br/>

## ⭐ Solving a day

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
aoc sync -y 2024        # record the answers AoC has already accepted
aoc reset -y 2024 -d 5  # forget a day you fetched, once you confirm
```

`-y` and `-d` default to the day you last looked at. `aoc -h` lists everything.

`aoc sync` catches a fresh clone up with the stars on your account. It fills in
what is missing and never overwrites an answer already recorded.

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

## 📂 Where things are

```
workspace/
  solutions/<lang>/<year>/dayNN/    the code you write
  puzzles/<year>/dayNN/
    puzzle.md  input.txt  sample.txt    gitignored: AoC asks these not be shared
    meta.json                           committed: the answers and the clock

cli/                                aoc itself
AGENTS.md                           what an AI assistant may do here
```

`meta.json` is the only thing committed beside a puzzle, because `aoc test`
needs it after a clone.

<br/>

## 📄 Licence

[AGPL-3.0](LICENSE). Use it, change it, share it. Run a modified version as a
service and you publish your changes.

Copyright © 2026 Damien Herrero
