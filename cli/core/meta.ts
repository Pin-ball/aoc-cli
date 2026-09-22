import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config.ts";
import type { Ref } from "./config.ts";

export type Part = "part1" | "part2";

export const PARTS: Part[] = ["part1", "part2"];

export const SAMPLE_FILE = "sample.txt";

/** Everything known about one part. `null` means "not known, do not check". */
export type PartRecord = {
  /** What this part should produce on sample.txt. */
  sample: string | null;
  /** What adventofcode.com accepted. */
  answer: string | null;
  /** Answers it rejected, so the same one is never sent twice. */
  wrong: string[];
  /** When it was accepted. */
  solved: string | null;
  /** Which languages last reproduced it, written by `aoc test`. */
  verified: Record<string, boolean>;
};

/**
 * One day's record. Committed to git: this is the regression suite, so it
 * must survive a fresh clone.
 */
export type Meta = {
  /** When `aoc new` fetched the day. The clock starts here, for both parts. */
  started: string | null;
} & Record<Part, PartRecord>;

const emptyPart = (): PartRecord => ({
  sample: null,
  answer: null,
  wrong: [],
  solved: null,
  verified: {},
});

const metaPath = (ref: Ref): string => path.join(dataDir(ref), "meta.json");

/** Missing sections are filled in, so a hand-trimmed meta.json cannot crash a run. */
export function readMeta(ref: Ref): Meta {
  const file = metaPath(ref);
  const saved = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};

  return {
    started: saved.started ?? null,
    part1: { ...emptyPart(), ...saved.part1 },
    part2: { ...emptyPart(), ...saved.part2 },
  };
}

export function writeMeta(ref: Ref, meta: Meta): void {
  const file = metaPath(ref);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(meta, null, 2)}\n`);
}

/**
 * Answers are compared as trimmed strings: some days answer with a word, and
 * an int from Python and a Number from JS must both match.
 */
export const same = (a: unknown, b: unknown): boolean =>
  a !== null && b !== null && String(a).trim() === String(b).trim();
