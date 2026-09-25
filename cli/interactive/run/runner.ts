import fs from "node:fs";
import path from "node:path";
import type { Ref } from "../../core/config.ts";
import { present } from "../../core/languages.ts";
import type { Language } from "../../core/languages.ts";
import { plannedRows, runDay, settle } from "../../core/solve.ts";
import { Abandoned, offloaded } from "./offload.ts";
import type { Stream } from "./offload.ts";
import type { Row } from "../../core/solve.ts";

const DEBOUNCE_MS = 60;

export type OutputLine = { lang: string; source: string; stream: Stream; text: string };

/** Enough to see a run's whole trace, not enough to grow without bound. */
const MAX_OUTPUT = 5_000;

export type RunState = {
  ref: Ref;
  langs: string[];
  rows: Row[];
  /** Whatever the solutions printed, which would otherwise scribble on the screen. */
  output: OutputLine[];
  isRunning: boolean;
  error: string | null;
};

/**
 * Runs one day and re-runs it when its code is saved. Every run carries a token
 * and a stale one is dropped, so a result from the day you just left cannot
 * paint over the day you are on.
 */
export class Runner {
  #onChange: () => void;
  #ref: Ref = { year: 0, day: 0 };
  #langs: Language[] = [];
  #plan: Row[] = [];
  #rows: Row[] = [];
  #error: string | null = null;
  #output: OutputLine[] = [];
  #token = 0;
  #settled = 0;
  #chain: Promise<void> = Promise.resolve();
  #watchers: fs.FSWatcher[] = [];
  #debounce: NodeJS.Timeout | undefined;
  #running: AbortController | undefined;

  constructor(onChange: () => void) {
    this.#onChange = onChange;
  }

  get state(): RunState {
    return {
      ref: this.#ref,
      langs: this.#langs.map((lang) => lang.id),
      rows: this.#rows,
      output: this.#output,
      isRunning: this.#settled !== this.#token,
      error: this.#error,
    };
  }

  /** Points at a day: runs it, then re-runs on every save until `close`. */
  open(ref: Ref): void {
    this.close();
    this.#ref = ref;
    this.#langs = present(ref).map((lang) =>
      offloaded(lang, {
        onOutput: (text, stream, source) => this.#capture(lang.id, source, stream, text),
        signal: () => this.#running?.signal,
      }),
    );
    this.#watchers = this.#langs.map((lang) =>
      fs.watch(path.dirname(lang.solutionPath(ref)), () => {
        clearTimeout(this.#debounce);
        this.#debounce = setTimeout(() => this.start(), DEBOUNCE_MS);
      }),
    );
    this.start();
  }

  /** Queues a run of the day already open. */
  start(): void {
    if (this.#langs.length === 0) {
      this.#rows = [];
      this.#onChange();
      return;
    }

    this.#running?.abort();
    this.#running = new AbortController();
    this.#token += 1;
    const token = this.#token;
    this.#plan = plannedRows(this.#ref, this.#langs);
    this.#rows = this.#plan;
    this.#error = null;
    this.#output = [];
    this.#onChange();
    this.#chain = this.#chain.then(() => this.#execute(token));
  }

  #capture(lang: string, source: string, stream: Stream, text: string): void {
    this.#output.push({ lang, source, stream, text });
    if (this.#output.length > MAX_OUTPUT) {
      this.#output.splice(0, this.#output.length - MAX_OUTPUT);
    }
    this.#onChange();
  }

  async #execute(token: number): Promise<void> {
    if (token !== this.#token) return;
    // Held now: a later run may repoint the fields while this one is awaiting.
    const ref = this.#ref;
    const plan = this.#plan;
    const langs = this.#langs;

    try {
      const rows = await runDay(ref, langs, {
        onProgress: (partial) => {
          if (token !== this.#token) return;
          this.#rows = settle(plan, partial);
          this.#onChange();
        },
      });
      if (token !== this.#token) return;
      this.#rows = settle(plan, rows);
    } catch (error) {
      if (token !== this.#token || error instanceof Abandoned) return;
      this.#error = (error as Error).message.split("\n")[0];
    }

    this.#settled = token;
    this.#onChange();
  }

  /** Stops watching and abandons whatever is in flight. */
  close(): void {
    clearTimeout(this.#debounce);
    this.#running?.abort();
    this.#running = undefined;
    for (const watcher of this.#watchers) watcher.close();
    this.#watchers = [];
    this.#token += 1;
    this.#settled = this.#token;
    this.#rows = [];
    this.#error = null;
    this.#output = [];
  }
}
