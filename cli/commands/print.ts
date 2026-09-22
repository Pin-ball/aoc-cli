import { pad } from "../core/config.ts";
import type { Ref } from "../core/config.ts";
import { duration } from "../core/format.ts";
import type { Row } from "../core/solve.ts";

const useColor = !process.env.NO_COLOR && process.stdout.isTTY;

const paint = (code: string, text: string): string =>
  useColor ? `\x1b[${code}m${text}\x1b[0m` : text;

export const dim = (t: string) => paint("2", t);
export const bold = (t: string) => paint("1", t);
const green = (t: string) => paint("32", t);
export const red = (t: string) => paint("31", t);
const yellow = (t: string) => paint("33", t);

/** One vocabulary of marks, used by every command. */
const MARK = {
  ok: green("✓"),
  fail: red("✗"),
  unknown: yellow("?"),
  skipped: dim("—"),
  error: red("!"),
  pending: dim("·"),
} as const;

const WORKING = dim("…");
const ACTION = dim("→");

/** The line every command opens with, so output is placeable at a glance. */
function title(text: string, note?: string): void {
  console.log(`\n  ${bold(text)}${note ? dim(`  ${note}`) : ""}\n`);
}

export const dayTitle = (ref: Ref, note?: string): void =>
  title(`${ref.year} day ${pad(ref.day)}`, note);

/** Longest rendered width of a column, for padding. */
const widest = <T,>(items: T[], of: (item: T) => string): number =>
  items.reduce((most, item) => Math.max(most, of(item).length), 0);

const shown = (row: Row) => (row.status === "pending" ? "…" : (row.answer ?? "—"));

/**
 * A day's results. Drawn from the full plan, so a row that has not run yet
 * holds its place and says so, rather than the table growing under you.
 */
export function printRows(ref: Ref, rows: Row[], note?: string): void {
  dayTitle(ref, note);

  if (rows.length === 0) {
    console.log(dim("  nothing to run yet\n"));
    return;
  }

  const langs = [...new Set(rows.map((row) => row.lang))];
  const columns = {
    lang: widest(langs, (lang) => lang),
    source: widest(rows, (row) => row.source),
    answer: Math.max(12, widest(rows, shown)),
    time: 7,
  };

  langs.forEach((lang, index) => {
    if (index > 0) console.log();

    for (const [line, row] of rows.filter((row) => row.lang === lang).entries()) {
      const label = `${(line === 0 ? lang : "").padEnd(columns.lang)}  `;
      const answer = shown(row).padEnd(columns.answer);

      console.log(
        `  ${dim(label)}${MARK[row.status]}  ${dim(row.source.padEnd(columns.source))}` +
          `  ${dim(row.part === "part1" ? "1" : "2")}   ` +
          `${row.answer === null ? dim(answer) : answer}` +
          `  ${dim((row.status === "pending" ? "…" : duration(row.micros)).padStart(columns.time))}` +
          detail(row),
      );
    }
  });

  console.log();
}

function detail(row: Row): string {
  if (row.status === "fail") return red(`  wanted ${row.expected}`);
  if (row.status === "error") return red(`  ${row.note}`);
  return "";
}

/** One line per day that passed, so only failures get the full table. */
export function printDayResult(ref: Ref, langs: string[], rows: Row[]): void {
  const slowest = Math.max(0, ...rows.map((row) => row.micros));
  console.log(
    `  ${MARK.ok}  ${dim(`day ${pad(ref.day)}`)}  ${langs.join(" ").padEnd(6)}` +
      `  ${dim(duration(slowest).padStart(7))}`,
  );
}

export const yearTitle = (year: number): void => title(String(year));

export function printTotals(passed: number, failed: number, skipped: number): void {
  const parts = [`${passed} passed`];
  if (failed > 0) parts.push(red(`${failed} failed`));
  if (skipped > 0) parts.push(dim(`${skipped} skipped`));
  console.log(`\n  ${parts.join(dim(" · "))}\n`);
}

/** A step a command is taking, so long waits are never silent. */
export const step = (text: string): void => console.log(`  ${ACTION} ${dim(text)}`);
export const working = (text: string): void => console.log(`  ${WORKING} ${dim(text)}`);
export const done = (text: string, note?: string): void =>
  console.log(`  ${MARK.ok}  ${text}${note ? dim(`   ${note}`) : ""}\n`);
export const failed = (text: string): void => console.log(`  ${MARK.fail}  ${text}\n`);
