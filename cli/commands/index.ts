import fs from "node:fs";
import path from "node:path";
import { fetchInput, fetchPuzzle, puzzleUrl, unlockTime } from "../core/aoc-api.ts";
import { currentYear, dataDir, pad, shown, yearDir } from "../core/config.ts";
import type { Ref } from "../core/config.ts";
import { byId, present } from "../core/languages.ts";
import type { Language } from "../core/languages.ts";
import { elapsed } from "../core/format.ts";
import { PARTS, readMeta, writeMeta } from "../core/meta.ts";
import type { Part } from "../core/meta.ts";
import { blockedBeforeRunning, choose, isBlocked, send } from "../core/submit.ts";
import { apply, plan } from "../core/reset.ts";
import { syncYear } from "../core/sync.ts";
import { gaveDay, gaveYear, parse, resolveLangs } from "./args.ts";
import {
  bold, dayTitle, dim, done, failed, printDayResult, printRows, printTotals, red, step, working, yearTitle,
} from "./print.ts";
import { confirm, openInBrowser } from "../core/shell.ts";
import { agreedAnswers, runDay } from "../core/solve.ts";
import { lastRun, saveLastRef, saveRun } from "../core/state.ts";
import { prepare } from "../core/workspace.ts";
import { answeredBy, changedSince, recordVerified } from "../core/runs.ts";

const HELP = `
  ${bold("aoc")} - Advent of Code, one harness for every language

  ${bold("aoc")}                 The interactive view: a calendar, a day that
                      re-runs as you save, and submitting from there
  ${bold("aoc <command>")}       One step at a time, for scripts and habit

  ${bold("Commands:")}
    new      Fetch a puzzle and scaffold it                    [alias: n]
    run      Samples then real input, both parts               [alias: r]
    test     Every day with a known answer, asserted           [alias: t]
    submit   Submit a part                                     [alias: s]
    open     Open the puzzle on adventofcode.com               [alias: o]
    watch    The interactive view, on the day you name         [alias: w]
    sync     Read accepted answers back from the site
    reset    Forget a day or a year you have fetched

  ${bold("Options:")}
    -y, --year <YEAR>   Puzzle year   ${dim("(default: the year you last ran)")}
    -d, --day <DAY>     Puzzle day    ${dim("(default: the day you last ran)")}
    -h, --help          Show this

  ${bold("Arguments:")}
    Languages are named plainly: ${dim("aoc run ts py")}
    submit takes the part: ${dim("aoc submit 2")}   ${dim("(default: the next unsolved one)")}
`;

async function cmdNew(tokens: string[]): Promise<void> {
  const today = new Date();
  const december = today.getMonth() === 11;
  if (!gaveDay(tokens) && !december) {
    throw new Error(`Which day? e.g. aoc new -y ${currentYear()} -d 5`);
  }

  const { ref, langs } = parse(tokens, { fallbackDay: december ? today.getDate() : undefined });
  const targets = langs.length > 0 ? langs : [byId("ts")];

  const until = unlockTime(ref).getTime() - Date.now();
  if (until > 0) {
    console.log(dim(`  ${ref.year} day ${pad(ref.day)} unlocks in ${Math.ceil(until / 60000)} min.`));
    return;
  }

  await fetchPuzzle(ref);
  await fetchInput(ref);

  const meta = readMeta(ref);
  meta.started ??= new Date().toISOString();
  writeMeta(ref, meta);

  for (const lang of targets) lang.scaffold(ref);
  saveLastRef(ref);

  dayTitle(ref);
  console.log(`  ${dim("data".padEnd(4))}  ${shown(dataDir(ref))}/`);
  for (const lang of targets) {
    console.log(`  ${dim(lang.id.padEnd(4))}  ${shown(lang.solutionPath(ref))}`);
  }
  console.log();
}

async function cmdRun(tokens: string[]): Promise<void> {
  const { ref, langs } = parse(tokens);
  const targets = resolveLangs(ref, langs);
  await fetchInput(ref).catch(() => undefined);
  await solveAndRemember(ref, targets, gaveDay(tokens));
}

/** Runs a day, remembers what it answered, and prints the table. */
async function solveAndRemember(ref: Ref, targets: Language[], named = true): Promise<void> {
  const rows = await runDay(ref, targets);
  saveRun(ref, agreedAnswers(rows), answeredBy(rows));
  printRows(ref, rows, named ? undefined : "the day you last ran");
}

/**
 * The interactive view, which is what a bare `aoc` opens. A named day is
 * remembered first, so it opens there; with no arguments it resumes
 * wherever you were.
 */
async function cmdInteractive(tokens: string[]): Promise<void> {
  if (tokens.length > 0) saveLastRef(parse(tokens).ref);
  await import("../interactive/main.ts");
}

/** Days of a year that have been fetched, oldest first, or just the one named. */
function fetchedDays(year: number, only: number | null): Ref[] {
  const dir = yearDir(year);
  if (!fs.existsSync(dir)) throw new Error(`No data for ${year}.`);

  return fs
    .readdirSync(dir)
    .filter((name) => /^day\d+$/.test(name))
    .map((name) => ({ year, day: Number(name.slice(3)) }))
    .filter((day) => only === null || day.day === only)
    .sort((a, b) => a.day - b.day);
}

async function cmdTest(tokens: string[]): Promise<void> {
  const { ref, langs } = parse(tokens);
  const days = fetchedDays(ref.year, gaveDay(tokens) ? ref.day : null);

  yearTitle(ref.year);
  if (days.length === 0) throw new Error(`No data for ${ref.year} day ${pad(ref.day)}.`);

  const tally = { passed: 0, failed: 0, skipped: 0 };
  for (const day of days) {
    const meta = readMeta(day);
    if (PARTS.every((part) => meta[part].answer === null)) {
      tally.skipped += 1;
      continue;
    }
    const available = present(day);
    const targets = langs.length > 0 ? langs.filter((l) => available.includes(l)) : available;
    if (targets.length === 0) continue;

    const rows = await runDay(day, targets, { samples: false });
    if (rows.length === 0) {
      tally.skipped += 1;
      continue;
    }
    recordVerified(day, rows);

    const bad = rows.filter((r) => r.status === "fail" || r.status === "error");
    tally.passed += rows.filter((r) => r.status === "ok").length;
    tally.failed += bad.length;
    if (bad.length > 0) printRows(day, rows);
    else printDayResult(day, targets.map((t) => t.id), rows);
  }

  printTotals(tally.passed, tally.failed, tally.skipped);
  if (tally.failed > 0) process.exitCode = 1;
}

async function cmdSubmit(tokens: string[]): Promise<void> {
  const { ref, langs, rest } = parse(tokens, { rest: true });
  if (rest.length > 1) throw new Error("Usage: aoc submit [-y YEAR] [-d DAY] [PART]");

  const [part] = rest;
  if (part !== undefined && part !== "1" && part !== "2") {
    throw new Error(`Part must be 1 or 2, got "${part}".`);
  }
  await submitFor(ref, langs, part ? (`part${part}` as Part) : undefined);
}

/** Everything `aoc submit` does once its arguments make sense. */
async function submitFor(ref: Ref, langs: Language[], forced?: Part): Promise<void> {
  const refused = blockedBeforeRunning(ref, readMeta(ref), forced);
  if (refused) throw new Error(refused.why);

  // Reuse the last run when nothing has moved since, so submitting a day that
  // takes minutes does not solve it a second time.
  const previous = lastRun();
  const reusable =
    previous?.ref.year === ref.year &&
    previous.ref.day === ref.day &&
    !changedSince(ref, previous.computedAt);

  let computed: Record<string, string | null>;
  let credited: Record<string, string[]>;
  if (reusable) {
    computed = previous.answers;
    credited = previous.by;
    working("reusing the answer from your last run");
  } else {
    working("solving");
    const targets = resolveLangs(ref, langs);
    await fetchInput(ref).catch(() => undefined);
    const rows = await runDay(ref, targets, { samples: false });
    computed = agreedAnswers(rows);
    credited = answeredBy(rows);
    recordVerified(ref, rows);
    saveRun(ref, computed, credited);
  }

  const choice = choose(ref, readMeta(ref), computed, credited, forced);
  if (isBlocked(choice)) throw new Error(choice.why);

  step(`submitting ${choice.answer} for ${choice.part}`);
  const verdict = await send(ref, choice);

  if (verdict.kind === "correct") {
    const meta = readMeta(ref);
    const took = elapsed(meta.started, meta[choice.part].solved);
    done(`correct: ${choice.answer}`, took ?? undefined);
    return;
  }
  if (verdict.kind === "wrong") {
    failed(`wrong (${verdict.hint}), recorded so it will not be resent`);
    process.exitCode = 1;
    return;
  }
  console.log(`  ${verdict.kind === "wait" ? "⏳" : "?"}  ${verdict.message}\n`);
  process.exitCode = 1;
}

/**
 * Reads a year's stars back from the site. Only an answer missing locally is
 * written; one already recorded is compared and reported, never replaced.
 */
async function cmdSync(tokens: string[]): Promise<void> {
  const { ref } = parse(tokens, { langs: false });

  yearTitle(ref.year);
  working("reading the calendar");

  const report = await syncYear(ref.year, (day, found) => {
    for (const part of found) {
      done(`day ${pad(day.day)} ${part}`, readMeta(day)[part].answer ?? undefined);
    }
  });

  for (const clash of report.conflicts) {
    failed(
      `day ${pad(clash.ref.day)} ${clash.part}: ${clash.local} here, ${clash.site} on the site` +
        dim("  left alone"),
    );
  }

  const parts = [`${report.recovered.length} recovered`];
  if (report.conflicts.length > 0) parts.push(red(`${report.conflicts.length} conflicting`));
  parts.push(dim(`${report.skipped} of ${report.starred} starred days already complete`));
  console.log(`\n  ${parts.join(dim(" · "))}\n`);

  if (report.conflicts.length > 0) process.exitCode = 1;
}

/**
 * Removes fetched puzzle data, never anything written. The scope has to be
 * named and then typed back, because the answers go with it.
 */
async function cmdReset(tokens: string[]): Promise<void> {
  const { ref } = parse(tokens, { langs: false });
  if (!gaveYear(tokens) && !gaveDay(tokens)) {
    throw new Error("Name what to reset: aoc reset -d 5, or aoc reset -y 2024 for a whole year.");
  }

  const scope = plan(ref.year, gaveDay(tokens) ? ref.day : null);
  if (scope.days === 0) throw new Error(`Nothing fetched for ${scope.what}.`);

  if (gaveDay(tokens)) dayTitle(ref);
  else yearTitle(ref.year);
  console.log(`  ${dim("removes")}  ${shown(scope.dir)}/`);
  console.log(`  ${dim("keeps")}    your solutions, which are not in there\n`);
  console.log(
    `  ${red("!")}  ${scope.days} day${scope.days === 1 ? "" : "s"}` +
      `, ${scope.answers} accepted answer${scope.answers === 1 ? "" : "s"}` +
      `${scope.answers > 0 ? dim("   aoc sync can bring the answers back") : ""}\n`,
  );

  if (!(await confirm(`  Type ${bold(scope.confirm)} to confirm: `, scope.confirm))) {
    console.log(dim("\n  Left alone.\n"));
    return;
  }

  apply(scope);
  done(`reset ${scope.what}`);
}

function cmdOpen(tokens: string[]): void {
  const { ref } = parse(tokens, { langs: false });
  const url = puzzleUrl(ref);
  console.log(dim(`  opening ${url}`));
  openInBrowser(url);
}

type Command = (tokens: string[]) => void | Promise<void>;

const COMMANDS: Record<string, Command> = {
  new: cmdNew,
  run: cmdRun,
  watch: cmdInteractive,
  test: cmdTest,
  submit: cmdSubmit,
  open: cmdOpen,
  sync: cmdSync,
  reset: cmdReset,
};

const ALIASES: Record<string, string> = {
  n: "new", r: "run", w: "watch", t: "test",
  s: "submit", o: "open",
};

const HELP_FLAGS = new Set(["help", "--help", "-h"]);

const [named, ...tokens] = process.argv.slice(2);

try {
  prepare();
  if (named === undefined) await cmdInteractive([]);
  else if (HELP_FLAGS.has(named)) console.log(HELP);
  else {
    const command = COMMANDS[ALIASES[named] ?? named];
    if (!command) throw new Error(`Unknown command "${named}". Try: aoc --help`);
    await command(tokens);
  }
} catch (error) {
  console.error(`\n  ${red("✗")}  ${(error as Error).message}\n`);
  process.exitCode = 1;
}
