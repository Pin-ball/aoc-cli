import fs from "node:fs";
import path from "node:path";
import { PUZZLES, dataDir, pad, yearDir } from "./config.ts";
import type { Ref } from "./config.ts";
import { PARTS, readMeta } from "./meta.ts";
import { forgetRun, lastRun } from "./state.ts";

export type Plan = {
  /** The scope in words, for the warning and the prompt. */
  what: string;
  dir: string;
  days: number;
  /** Accepted answers about to be lost, which is the part worth a second thought. */
  answers: number;
  /** What the person has to type back. */
  confirm: string;
};

const daysUnder = (dir: string): Ref[] => {
  const year = Number(path.basename(dir));
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /^day\d+$/.test(name))
    .map((name) => ({ year, day: Number(name.slice(3)) }));
};

const answersIn = (refs: Ref[]): number =>
  refs.reduce(
    (total, ref) => total + PARTS.filter((part) => readMeta(ref)[part].answer !== null).length,
    0,
  );

/**
 * What a reset would remove. Only ever a directory under `workspace/puzzles/`,
 * so nothing you wrote can be in scope: solutions live elsewhere entirely.
 */
export function plan(year: number, day: number | null): Plan {
  if (day !== null) {
    const ref = { year, day };
    return {
      what: `${year} day ${pad(day)}`,
      dir: dataDir(ref),
      days: fs.existsSync(dataDir(ref)) ? 1 : 0,
      answers: answersIn([ref]),
      confirm: String(day),
    };
  }

  const dir = yearDir(year);
  const refs = daysUnder(dir);
  return { what: String(year), dir, days: refs.length, answers: answersIn(refs), confirm: String(year) };
}

const within = (dir: string, file: string): boolean => {
  const inside = path.relative(path.resolve(dir), path.resolve(file));
  return inside !== "" && !inside.startsWith("..") && !path.isAbsolute(inside);
};

/** Refuses anything that is not fetched puzzle data, whatever it was handed. */
export function guard(dir: string): void {
  if (!within(PUZZLES, dir)) {
    throw new Error(`Refusing to remove ${dir}: only fetched puzzle data can be reset.`);
  }
}

export function apply(plan: Plan): void {
  guard(plan.dir);
  fs.rmSync(plan.dir, { recursive: true, force: true });

  const previous = lastRun();
  if (previous && within(plan.dir, dataDir(previous.ref))) forgetRun();
}
