import type { Surface } from "../../tui/buffer.ts";
import { shown } from "../../core/config.ts";
import { byId } from "../../core/languages.ts";
import { duration } from "../../core/format.ts";
import type { Row, Status } from "../../core/solve.ts";
import type { Style } from "../../tui/style.ts";
import type { DayView } from "../data.ts";
import type { RunState } from "../run/runner.ts";
import { PAD } from "./chrome.ts";
import { LANG_STYLE, THEME } from "./theme.ts";

const SOURCE = 9;
const PART = 17;
const STATUS = 20;
const ANSWER = 23;

/** A glyph for each of the six statuses `cli/core/solve.ts` can produce. */
const MARK: Record<Status, { glyph: string; style: Style }> = {
  ok: { glyph: "✓", style: THEME.ok },
  fail: { glyph: "✗", style: THEME.bad },
  unknown: { glyph: "?", style: THEME.star },
  skipped: { glyph: "—", style: THEME.faint },
  error: { glyph: "!", style: THEME.bad },
  pending: { glyph: "·", style: THEME.faint },
};

const bySource = (rows: Row[]): Map<string, Row[]> => {
  const groups = new Map<string, Row[]>();
  for (const row of rows) groups.set(row.source, [...(groups.get(row.source) ?? []), row]);
  return groups;
};

const languagesIn = (rows: Row[]): string[] => [...new Set(rows.map((row) => row.lang))];

/** The lines a table takes: its rows, the gaps between sources, the rules between languages. */
export function heightOf(rows: Row[]): number {
  const gaps = languagesIn(rows).reduce(
    (total, lang) => total + bySource(rows.filter((row) => row.lang === lang)).size - 1,
    0,
  );
  return rows.length + gaps + Math.max(0, languagesIn(rows).length - 1) * 3;
}

/** What goes on the right of a row: the failure if there is one, the time otherwise. */
function trailing(row: Row): { text: string; style: Style } {
  if (unchecked(row)) return { text: "no expected answer", style: THEME.faint };
  if (row.status === "fail") return { text: `wanted ${row.expected}`, style: THEME.bad };
  if (row.status === "error") return { text: row.note ?? "threw", style: THEME.bad };
  if (row.status === "pending" || row.status === "skipped") return { text: "", style: THEME.faint };
  return { text: duration(row.micros), style: THEME.faint };
}

/**
 * `unknown` means two different things. On the real input it is an answer AoC
 * has not seen yet, so there is something to submit. On a sample it is a gap
 * in `meta.json` where no expected answer was recorded, so there is nothing to
 * check against. Same status, different glyph, because the next move is different.
 */
const unchecked = (row: Row): boolean => row.status === "unknown" && row.source === "sample";

const markFor = (row: Row): { glyph: string; style: Style } =>
  unchecked(row) ? { glyph: "○", style: THEME.faint } : MARK[row.status];

function drawRow(surface: Surface, y: number, row: Row): void {
  const mark = markFor(row);
  surface.write(PART, y, row.part === "part1" ? "1" : "2", THEME.muted);
  surface.write(STATUS, y, mark.glyph, mark.style);

  const trail = trailing(row);
  const room = Math.max(0, surface.width - ANSWER - trail.text.length - 4);
  const answer = row.answer ?? (row.status === "pending" ? "" : "—");
  surface.write(ANSWER, y, answer.slice(0, room), row.answer === null ? THEME.faint : THEME.text);
  surface.writeRight(y, `${trail.text}  `, trail.style);
}

function drawTable(surface: Surface, rows: Row[]): void {
  let y = 0;

  for (const [nth, lang] of languagesIn(rows).entries()) {
    if (nth > 0) {
      surface.write(PAD, y + 1, "─".repeat(Math.max(0, surface.width - PAD * 2)), THEME.line);
      y += 3;
    }

    let isFirstRow = true;
    for (const [source, group] of bySource(rows.filter((row) => row.lang === lang))) {
      if (!isFirstRow) y += 1;

      for (const [index, row] of group.entries()) {
        if (y >= surface.height) return;
        if (isFirstRow) surface.write(PAD, y, lang, LANG_STYLE[lang] ?? THEME.text);
        if (index === 0) surface.write(SOURCE, y, source, THEME.muted);
        isFirstRow = false;
        drawRow(surface, y, row);
        y += 1;
      }
    }
  }
}

/** Why there is no table: not open, not fetched, nothing written, nothing to read. */
function drawEmpty(surface: Surface, day: DayView, run: RunState): void {
  const say = (headline: string, hint: string, key = false) => {
    surface.write(PAD, 0, headline, THEME.muted);
    if (key) surface.write(PAD, 2, "n", THEME.hintKey);
    surface.write(PAD + (key ? 4 : 0), 2, hint, THEME.hintLabel);
  };

  if (day.unlocksIn !== null) {
    say("not open yet", `adventofcode.com releases it in ${day.unlocksIn}`);
  } else if (day.title === null) {
    say("not fetched", "fetch the puzzle, the input and a file to write in", true);
  } else if (run.langs.length === 0) {
    say("nothing written yet", `start ${shown(byId("ts").solutionPath(run.ref))}`, true);
  } else {
    say("nothing to run", "this day has neither a sample nor an input", false);
  }
}

/** What every language makes of the samples and the real input, or why it cannot. */
export function drawResults(surface: Surface, day: DayView, run: RunState): void {
  if (run.error !== null) {
    surface.write(PAD, 0, run.error.slice(0, surface.width - PAD - 2), THEME.bad);
  } else if (run.langs.length > 0 && run.rows.length > 0) {
    drawTable(surface, run.rows);
  } else {
    drawEmpty(surface, day, run);
  }
}
