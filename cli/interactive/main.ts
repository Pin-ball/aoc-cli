import { Surface } from "../tui/buffer.ts";
import { Screen } from "../tui/screen.ts";
import { fetchInput, fetchPuzzle, puzzleUrl, unlockTime } from "../core/aoc-api.ts";
import { pad } from "../core/config.ts";
import type { Ref } from "../core/config.ts";
import { byId } from "../core/languages.ts";
import { readMeta, writeMeta } from "../core/meta.ts";
import { openInBrowser } from "../core/shell.ts";
import { saveLastRef } from "../core/state.ts";
import { isBlocked, send } from "../core/submit.ts";
import { clampScroll, initial, reduce, refOf, refresh, scrollOf } from "./app.ts";
import type { Effect, State } from "./app.ts";
import { drawCalendar } from "./draw/calendar.ts";
import { drawDay, scrollLimit } from "./draw/day.ts";
import { drawHelp } from "./draw/help.ts";
import { Runner } from "./run/runner.ts";
import { choiceFor, drawSubmit } from "./draw/submit.ts";
import { Tester } from "./run/tester.ts";
import { drawTesting } from "./draw/testing.ts";

const TICK_MS = 90;

let state = initial();
let tick = 0;

/** Set once the terminal is taken. The runners call it without knowing about it. */
let repaint: () => void = () => undefined;

const runner = new Runner(() => repaint());
const tester = new Tester(() => repaint());

function draw(surface: Surface): void {
  if (state.screen === "test") drawTesting(surface, tester.state, tick);
  else if (state.screen === "calendar") drawCalendar(surface, state.view, state.day, state.notice);
  else {
    const day = state.view.days[state.day - 1];
    drawDay(surface, day, runner.state, tick, state.notice, state.tab, scrollOf(state));
  }

  if (state.overlay === "help") drawHelp(surface, state.screen);
  if (state.overlay === "submit") drawSubmit(surface, runner.state);
}

/** Replaces the hint line until the next keystroke. `null` hands it back. */
function say(notice: string | null): void {
  state = { ...state, notice };
  repaint();
}

/** Sends the answer the run produced, and takes in what AoC says back. */
async function submitDay(): Promise<void> {
  const run = runner.state;
  const choice = choiceFor(run);
  if (isBlocked(choice)) return say(choice.why);

  say(`submitting ${choice.answer} for ${choice.part}…`);
  try {
    const verdict = await send(run.ref, choice);
    state = refresh(state);
    if (verdict.kind === "correct") say(`correct: ${choice.answer}`);
    else if (verdict.kind === "wrong") say(`wrong (${verdict.hint}), recorded so it will not be resent`);
    else say(verdict.message);
    runner.open(run.ref);
  } catch (error) {
    say((error as Error).message.split("\n")[0]);
  }
}

/**
 * What `aoc new` does, from the day you are standing on: the statement, the
 * input, the clock started, and a TypeScript file to write the answer in.
 */
async function fetchDay(): Promise<void> {
  const ref = refOf(state);
  const until = unlockTime(ref).getTime() - Date.now();
  if (until > 0) {
    return say(`${ref.year} day ${pad(ref.day)} unlocks in ${Math.ceil(until / 60_000)} min`);
  }

  say(`fetching ${ref.year} day ${pad(ref.day)}…`);
  try {
    await fetchPuzzle(ref);
    await fetchInput(ref);
    const meta = readMeta(ref);
    meta.started ??= new Date().toISOString();
    writeMeta(ref, meta);
    byId("ts").scaffold(ref);

    state = refresh(state);
    if (state.screen === "day") runner.open(ref);
    say(null);
  } catch (error) {
    say((error as Error).message.split("\n")[0]);
  }
}

function perform(effect: Effect): void {
  if (effect === "rerun") runner.start();
  if (effect === "browse") openInBrowser(puzzleUrl(refOf(state)));
  if (effect === "fetch") void fetchDay();
  if (effect === "submit") void submitDay();
  if (effect === "test") tester.start(state.view.year);
}

const sameDay = (a: Ref, b: Ref): boolean => a.year === b.year && a.day === b.day;

/** Points the runner and the tester at whatever the new state is looking at. */
function follow(before: State, after: State): void {
  const opened = after.screen === "day" && before.screen !== "day";
  if (opened || (after.screen === "day" && !sameDay(refOf(before), refOf(after)))) {
    runner.open(refOf(after));
    saveLastRef(refOf(after));
  }
  if (after.screen !== "day" && before.screen === "day") runner.close();
  if (after.screen !== "test" && before.screen === "test") tester.stop();
}

/** One frame as plain text, for a pipe, a snapshot test or a terminal-less CI. */
function once(): void {
  const size = /^(\d+)x(\d+)$/.exec(process.env.AOC_SIZE ?? "");
  const surface = Surface.create(
    size ? Number(size[1]) : (process.stdout.columns ?? 80),
    size ? Number(size[2]) : (process.stdout.rows ?? 26),
  );
  draw(surface);
  console.log(surface.lines().join("\n"));
}

function run(): void {
  const screen = Screen.take();
  repaint = () => screen.render(draw);

  const leave = () => {
    tester.stop();
    runner.close();
    screen.close();
    process.exit(0);
  };

  const spinner = setInterval(() => {
    const busy = state.screen === "test" ? tester.state.isRunning : runner.state.isRunning;
    if (!busy || (state.screen !== "day" && state.screen !== "test")) return;
    tick += 1;
    repaint();
  }, TICK_MS);
  spinner.unref();

  screen.onResize(repaint);
  screen.onKey((key) => {
    const before = state;
    const { state: next, effect } = reduce(before, key);
    if (next.isDone) return leave();

    state = next;
    if (effect) perform(effect);
    follow(before, state);

    if (state.screen === "day") {
      state = clampScroll(state, scrollLimit(state.tab, runner.state, screen.height));
    }
    repaint();
  });

  repaint();
}

if (process.stdout.isTTY && process.stdin.isTTY) run();
else once();
