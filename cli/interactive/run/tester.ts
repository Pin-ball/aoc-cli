import fs from "node:fs";
import path from "node:path";
import { yearDir } from "../../core/config.ts";
import type { Ref } from "../../core/config.ts";
import { present } from "../../core/languages.ts";
import { PARTS, readMeta } from "../../core/meta.ts";
import { runDay } from "../../core/solve.ts";
import { recordVerified } from "../../core/runs.ts";
import { Abandoned, offloaded } from "./offload.ts";

export type Verdict = "waiting" | "running" | "pass" | "fail" | "skipped";

export type Outcome = {
  day: number;
  langs: string[];
  verdict: Verdict;
  micros: number;
  note: string | null;
};

export type TestState = { year: number; days: Outcome[]; isRunning: boolean };

/** Days of a year with an accepted answer to assert against, in order. */
function candidates(year: number): Outcome[] {
  const dir = yearDir(year);
  if (!fs.existsSync(dir)) return [];

  return fs
    .readdirSync(dir)
    .filter((name) => /^day\d+$/.test(name))
    .map((name): Outcome => {
      const ref: Ref = { year, day: Number(name.slice(3)) };
      const langs = present(ref).map((lang) => lang.id);
      const known = PARTS.some((part) => readMeta(ref)[part].answer !== null);
      return {
        day: ref.day,
        langs,
        verdict: known && langs.length > 0 ? "waiting" : "skipped",
        micros: 0,
        note: known ? null : "no accepted answer",
      };
    })
    .sort((a, b) => a.day - b.day);
}

/** `aoc test` for one year, a day at a time, abandonable part way through. */
export class Tester {
  #onChange: () => void;
  #year = 0;
  #days: Outcome[] = [];
  #isRunning = false;
  #running: AbortController | undefined;

  constructor(onChange: () => void) {
    this.#onChange = onChange;
  }

  get state(): TestState {
    return { year: this.#year, days: this.#days, isRunning: this.#isRunning };
  }

  start(year: number): void {
    this.stop();
    this.#year = year;
    this.#days = candidates(year);
    this.#isRunning = true;
    this.#running = new AbortController();
    this.#onChange();
    void this.#walk(this.#running.signal);
  }

  async #walk(signal: AbortSignal): Promise<void> {
    for (const outcome of this.#days) {
      if (signal.aborted) return;
      if (outcome.verdict !== "waiting") continue;

      outcome.verdict = "running";
      this.#onChange();

      const ref: Ref = { year: this.#year, day: outcome.day };
      const langs = present(ref).map((lang) => offloaded(lang, { signal: () => signal }));

      try {
        const rows = await runDay(ref, langs, { samples: false });
        if (signal.aborted) return;
        recordVerified(ref, rows);

        const bad = rows.filter((row) => row.status === "fail" || row.status === "error");
        outcome.micros = Math.max(0, ...rows.map((row) => row.micros));
        outcome.verdict = bad.length > 0 ? "fail" : "pass";
        outcome.note = bad[0] ? (bad[0].note ?? `${bad[0].part} differs`) : null;
      } catch (error) {
        if (signal.aborted || error instanceof Abandoned) return;
        outcome.verdict = "fail";
        outcome.note = (error as Error).message.split("\n")[0];
      }
      this.#onChange();
    }

    this.#isRunning = false;
    this.#onChange();
  }

  /** Abandons whatever is in flight and leaves the results already gathered. */
  stop(): void {
    this.#running?.abort();
    this.#running = undefined;
    this.#isRunning = false;
  }
}

export const tally = (days: Outcome[]) => ({
  passed: days.filter((day) => day.verdict === "pass").length,
  failed: days.filter((day) => day.verdict === "fail").length,
  skipped: days.filter((day) => day.verdict === "skipped").length,
});
