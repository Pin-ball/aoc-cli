import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");

export type Ref = { year: number; day: number };

/** Your side of the repo: what AoC sent you, and what you wrote. */
const WORKSPACE = path.join(ROOT, "workspace");
export const PUZZLES = path.join(WORKSPACE, "puzzles");
export const SOLUTIONS = path.join(WORKSPACE, "solutions");

/**
 * Path as the caller can use it: relative when they are inside the repo,
 * absolute when `aoc` was run from somewhere else.
 */
export function shown(file: string): string {
  const here = path.relative(process.cwd(), file);
  return here.startsWith("..") ? file : here;
}

/** Zero-padded day, e.g. 5 -> "05". */
export const pad = (day: number): string => String(day).padStart(2, "0");

/** Everything kept for one year: one directory per day. */
export const yearDir = (year: number): string => path.join(PUZZLES, String(year));

/** Directory holding input, samples, puzzle text and meta for one day. */
export const dataDir = ({ year, day }: Ref): string => path.join(yearDir(year), `day${pad(day)}`);

/**
 * The year AoC is currently on: December means this year, otherwise the
 * previous December.
 */
export function currentYear(): number {
  const now = new Date();
  return now.getMonth() === 11 ? now.getFullYear() : now.getFullYear() - 1;
}
