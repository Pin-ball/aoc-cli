import fs from "node:fs";
import path from "node:path";
import { PUZZLES } from "./config.ts";
import type { Ref } from "./config.ts";

/**
 * What the CLI remembers between invocations: the day you were on, and what it
 * answered, so submitting does not have to solve a slow day twice. Lives in
 * gitignored workspace/puzzles/.state.json.
 */
const STATE = path.join(PUZZLES, ".state.json");

export type LastRun = {
  ref: Ref;
  answers: Record<string, string | null>;
  /** part -> languages that produced that answer, so a submit can credit them. */
  by: Record<string, string[]>;
  computedAt: number;
};

function read(): Partial<LastRun> {
  if (!fs.existsSync(STATE)) return {};
  try {
    return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch {
    return {};
  }
}

function write(state: Partial<LastRun>): void {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, `${JSON.stringify(state, null, 2)}\n`);
}

/** The day a bare `aoc` repeats, or null before anything has run. */
export const lastRef = (): Ref | null => read().ref ?? null;

/** The previous run, when there is one to reuse. */
export function lastRun(): LastRun | null {
  const state = read();
  if (!state.ref || !state.answers || !state.by || !state.computedAt) return null;
  return state as LastRun;
}

export const saveLastRef = (ref: Ref): void => write({ ...read(), ref });

/** Drops the remembered answers, so a reset day is never submitted from cache. */
export const forgetRun = (): void => write({ ref: read().ref });

export function saveRun(ref: Ref, answers: Record<string, string | null>, by: Record<string, string[]>): void {
  write({ ref, answers, by, computedAt: Date.now() });
}
