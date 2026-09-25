import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config.ts";
import type { Ref } from "./config.ts";
import { PARTS, readMeta, same, SAMPLE_FILE } from "./meta.ts";
import type { Part } from "./meta.ts";
import type { DayResult, Language } from "./languages.ts";

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
async function attempt(
  lang: Language,
  source: string,
  solve: () => Promise<DayResult>,
  expected: Record<Part, string | null>,
): Promise<Row[]> {
  try {
    return rowsFor(lang, source, await solve(), expected);
  } catch (error) {
    const note = (error as Error).message.split("\n")[0];
    return PARTS.map((part) => ({
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

function rowsFor(lang: Language, source: string, result: DayResult, expected: Record<Part, string | null>): Row[] {
  return PARTS.map((part) => {
    const { answer, micros, error } = result[part];
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

/**
 * Runs every sample then the real input. Pure: callers decide what to remember,
 * so `aoc test` can loop over days without repointing what `aoc submit` would
 * send.
 */
export async function runDay(
  ref: Ref,
  langs: Language[],
  { samples = true, onProgress }: { samples?: boolean; onProgress?: (rows: Row[]) => void } = {},
): Promise<Row[]> {
  const meta = readMeta(ref);
  const dir = dataDir(ref);
  const input = path.join(dir, "input.txt");
  const rows: Row[] = [];

  for (const lang of langs) {
    const sample = path.join(dir, SAMPLE_FILE);
    if (samples && fs.existsSync(sample)) {
      onProgress?.(rows);
      const expected = { part1: meta.part1.sample, part2: meta.part2.sample };
      rows.push(...(await attempt(lang, "sample", () => lang.solve(ref, sample), expected)));
    }

    if (!fs.existsSync(input)) continue;
    onProgress?.(rows);
    const expected = { part1: meta.part1.answer, part2: meta.part2.answer };
    rows.push(...(await attempt(lang, "input", () => lang.solve(ref, input), expected)));
  }

  return rows;
}

/**
 * The shape a run will take, so the table can be drawn in full before any of it
 * is known and the rows fill in where they sit instead of appearing.
 */
export function plannedRows(ref: Ref, langs: Language[], { samples = true } = {}): Row[] {
  const dir = dataDir(ref);
  const sources = [
    ...(samples && fs.existsSync(path.join(dir, SAMPLE_FILE)) ? ["sample"] : []),
    ...(fs.existsSync(path.join(dir, "input.txt")) ? ["input"] : []),
  ];

  return langs.flatMap((lang) =>
    sources.flatMap((source) =>
      PARTS.map((part) => ({
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
