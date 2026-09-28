import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config.ts";
import type { Ref } from "./config.ts";
import { PARTS, readMeta, same, SAMPLE_FILE } from "./meta.ts";
import type { Meta, Part } from "./meta.ts";
import type { DayResult, Language } from "./languages.ts";

export type RunMode = "sample" | "all" | "input";

export const RUN_MODES: RunMode[] = ["all", "sample", "input"];

export type Scope = { mode: RunMode; parts: Part[] };

export const EVERYTHING: Scope = { mode: "all", parts: PARTS };

export const INPUT_ONLY: Scope = { mode: "input", parts: PARTS };

export type Status = "ok" | "fail" | "unknown" | "skipped" | "error" | "pending";

export type Row = {
  lang: string;
  source: string;
  part: Part;
  answer: string | null;
  expected: string | null;
  micros: number;
  status: Status;
  note?: string;
};

/** A throw in one place must not cost you the results from everywhere else. */
async function attempt(lang: Language, ref: Ref, run: Run): Promise<Row[]> {
  const { source, file, parts, expected } = run;
  try {
    return rowsFor(lang, source, await lang.solve(ref, file, parts), parts, expected);
  } catch (error) {
    const note = (error as Error).message.split("\n")[0];
    return parts.map((part) => ({
      lang: lang.id,
      source,
      part,
      answer: null,
      expected: expected[part],
      micros: 0,
      status: "error" as Status,
      note,
    }));
  }
}

function rowsFor(
  lang: Language,
  source: string,
  result: DayResult,
  parts: Part[],
  expected: Record<Part, string | null>,
): Row[] {
  return parts.map((part) => {
    const { answer, micros, error } = result[part] ?? { answer: null, micros: 0 };
    const want = expected[part];
    const status: Status = error
      ? "error"
      : answer === null
        ? "skipped"
        : want === null
          ? "unknown"
          : same(answer, want)
            ? "ok"
            : "fail";
    return { lang: lang.id, source, part, answer, expected: want, micros, status, note: error };
  });
}

type Run = { source: string; file: string; parts: Part[]; expected: Record<Part, string | null> };

function runsFor(ref: Ref, meta: Meta, { mode, parts }: Scope): Run[] {
  const dir = dataDir(ref);
  const sample = path.join(dir, SAMPLE_FILE);
  const input = path.join(dir, "input.txt");
  const runs: Run[] = [];

  if (mode !== "input" && fs.existsSync(sample)) {
    const expected = { part1: meta.part1.sample, part2: meta.part2.sample };
    runs.push({ source: "sample", file: sample, parts, expected });
  }
  if (mode !== "sample" && fs.existsSync(input)) {
    const expected = { part1: meta.part1.answer, part2: meta.part2.answer };
    runs.push({ source: "input", file: input, parts, expected });
  }
  return runs;
}

/**
 * Runs the samples then the real input, as far as the scope allows. Pure:
 * callers decide what to remember, so `aoc test` can loop over days without
 * repointing what `aoc submit` would send.
 */
export async function runDay(
  ref: Ref,
  langs: Language[],
  { scope = EVERYTHING, onProgress }: { scope?: Scope; onProgress?: (rows: Row[]) => void } = {},
): Promise<Row[]> {
  const runs = runsFor(ref, readMeta(ref), scope);
  const rows: Row[] = [];

  for (const lang of langs) {
    for (const run of runs) {
      onProgress?.(rows);
      rows.push(...(await attempt(lang, ref, run)));
    }
  }
  return rows;
}

/**
 * The shape a run will take, so the table can be drawn in full before any of it
 * is known and the rows fill in where they sit instead of appearing.
 */
export function plannedRows(ref: Ref, langs: Language[], scope: Scope = EVERYTHING): Row[] {
  const runs = runsFor(ref, readMeta(ref), scope);
  return langs.flatMap((lang) =>
    runs.flatMap(({ source, parts }) =>
      parts.map((part) => ({
        lang: lang.id,
        source,
        part,
        answer: null,
        expected: null,
        micros: 0,
        status: "pending" as Status,
      })),
    ),
  );
}

/** Rows that have run, laid over the plan they belong to. */
export const settle = (plan: Row[], done: Row[]): Row[] =>
  plan.map((row) => done.find((d) => d.lang === row.lang && d.source === row.source && d.part === row.part) ?? row);

/** Real-input answers every language agreed on; null for a part they disagreed on. */
export function agreedAnswers(rows: Row[]): Record<string, string | null> {
  const answers: Record<string, string | null> = {};
  for (const row of rows) {
    if (row.source !== "input" || row.answer === null) continue;
    if (!(row.part in answers)) answers[row.part] = row.answer;
    else if (answers[row.part] !== row.answer) answers[row.part] = null;
  }
  return answers;
}
