import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config.ts";
import type { Ref } from "./config.ts";
import { PARTS, readMeta, same, SAMPLE_FILE } from "./meta.ts";
import type { Meta, Part } from "./meta.ts";
import type { Language } from "./languages.ts";

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
async function attempt(lang: Language, ref: Ref, { source, file, part, expected }: Run): Promise<Row> {
  try {
    const { answer, micros, error } = (await lang.solve(ref, file, [part]))[part] ?? { answer: null, micros: 0 };
    const status: Status = error
      ? "error"
      : answer === null
        ? "skipped"
        : expected === null
          ? "unknown"
          : same(answer, expected)
            ? "ok"
            : "fail";
    return { lang: lang.id, source, part, answer, expected, micros, status, note: error };
  } catch (error) {
    const note = (error as Error).message.split("\n")[0];
    return { lang: lang.id, source, part, answer: null, expected, micros: 0, status: "error", note };
  }
}

type Run = { source: string; file: string; part: Part; expected: string | null };

function runsFor(ref: Ref, meta: Meta, { mode, parts }: Scope): Run[] {
  const dir = dataDir(ref);
  const sample = path.join(dir, SAMPLE_FILE);
  const input = path.join(dir, "input.txt");
  const sources: { source: string; file: string; expect: (part: Part) => string | null }[] = [];

  if (mode !== "input" && fs.existsSync(sample)) {
    sources.push({ source: "sample", file: sample, expect: (part) => meta[part].sample });
  }
  if (mode !== "sample" && fs.existsSync(input)) {
    sources.push({ source: "input", file: input, expect: (part) => meta[part].answer });
  }
  return parts.flatMap((part) =>
    sources.map(({ source, file, expect }) => ({ source, file, part, expected: expect(part) })),
  );
}

/**
 * Runs each part on the sample then the real input, as far as the scope
 * allows, and stops once `signal` is aborted. Pure: callers decide what to
 * remember, so `aoc test` can loop over days without repointing what
 * `aoc submit` would send.
 */
export async function runDay(
  ref: Ref,
  langs: Language[],
  {
    scope = EVERYTHING,
    signal,
    onProgress,
  }: { scope?: Scope; signal?: AbortSignal; onProgress?: (rows: Row[]) => void } = {},
): Promise<Row[]> {
  const runs = runsFor(ref, readMeta(ref), scope);
  const rows: Row[] = [];

  for (const run of runs) {
    for (const lang of langs) {
      if (signal?.aborted) return rows;
      onProgress?.(rows);
      rows.push(await attempt(lang, ref, run));
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
    runs.map(({ source, part }) => ({
      lang: lang.id,
      source,
      part,
      answer: null,
      expected: null,
      micros: 0,
      status: "pending" as Status,
    })),
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
